import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_PRODUCTION_SOURCE_URLS, parseWgiVoiceAccountability } from "../src/lib/ci/production-source-adapters";
import { fetchBuffer } from "../src/lib/ci/source-utils";
import { CI_TOURNAMENT_PANEL_V3_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { buildTournamentPanelV2 } from "./generate-ci-tournament-panel-v2";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");
const WGI_SHA256 = "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8";

export async function buildTournamentPanelV3() {
  const v2 = await buildTournamentPanelV2();
  const workbook = await fetchBuffer(CI_PRODUCTION_SOURCE_URLS.worldbankWgi);
  const workbookHash = createHash("sha256").update(workbook).digest("hex");
  if (workbookHash !== WGI_SHA256) throw new Error(`WGI workbook hash drifted: ${workbookHash}`);
  const va = new Map<string, number>();
  for (let year = 2000; year <= 2024; year++) {
    if (year === 2001) continue;
    for (const record of parseWgiVoiceAccountability(workbook, year).records) va.set(`${record.iso3}:${year}`, record.rawValue);
  }
  const jurisdictions = [...new Map(v2.rows.map((row) => [row.jurisdictionId, { jurisdictionId: row.jurisdictionId, iso3: (row as typeof row & { iso3?: string }).iso3 }])).values()];
  // V2 rows do not expose ISO3 in the frozen row contract; recover the mapping from the live spine.
  const spine = await sql`SELECT id::text AS "jurisdictionId",iso3 FROM jurisdictions WHERE type='sovereign_state' AND iso3 IS NOT NULL ORDER BY iso3` as unknown as Array<{ jurisdictionId: string; iso3: string }>;
  if (spine.length !== 194) throw new Error(`sovereign spine has ${spine.length} rows, expected 194`);
  void jurisdictions;
  const added = spine.flatMap((jurisdiction) => Array.from({ length: 25 }, (_, offset) => {
    const periodYear = 2000 + offset;
    const value = va.get(`${jurisdiction.iso3}:${periodYear}`) ?? null;
    const core = {
      releaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, jurisdictionId: jurisdiction.jurisdictionId, periodYear,
      dimension: "democratic_quality", indicatorId: "va.est", sourceId: "worldbank_wgi",
      sourceOwner: "World Bank Worldwide Governance Indicators", retrievalPath: "publisher_bulk_download",
      value, valueStatus: value === null ? "missing" : "observed",
      missingReason: value !== null ? null : periodYear === 2001 ? "source_not_published_for_period" : "source_no_observation_for_jurisdiction_period",
      nativeUnit: "WGI Voice and Accountability estimate (approximately −2.5 to 2.5)", nativeMin: -2.5, nativeMax: 2.5, isInverted: false,
      transformId: "identity_native_scale/v1", sourceVintage: "WGI 2025 methodology revision", sourceVintageStatus: "exact_publisher_workbook_version",
      artifactHash: WGI_SHA256, uncertaintyStatus: "standard_errors_available_upstream_not_retained", uncertaintyLower: null, uncertaintyUpper: null,
      revisionStatus: "revisable_current_harmonized_series", seriesType: "current_harmonized_backcast_not_as_published",
    };
    return { ...core, contentHash: researchPanelHash(core) };
  }));
  const rows = [...v2.rows.map((row) => {
    const { contentHash: _, ...priorCore } = row;
    const core = { ...priorCore, releaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID };
    return { ...core, contentHash: researchPanelHash(core) };
  }), ...added].sort((a, b) => `${a.sourceId}:${a.indicatorId}:${a.periodYear}:${a.jurisdictionId}`.localeCompare(`${b.sourceId}:${b.indicatorId}:${b.periodYear}:${b.jurisdictionId}`));
  const coverage = [...new Set(rows.map((row) => `${row.sourceId}:${row.indicatorId}`))].sort().map((identity) => {
    const matching = rows.filter((row) => `${row.sourceId}:${row.indicatorId}` === identity);
    return { identity, observed: matching.filter((row) => row.valueStatus === "observed").length, missing: matching.filter((row) => row.valueStatus === "missing").length };
  });
  const temporalBreaks = [...v2.temporalBreaks, { sourceId: "worldbank_wgi", indicatorId: "va.est", period: "2000; 2002–2024", treatment: "2001 is structural nonpublication; V-Dem remains primary and VA is used only when V-Dem is absent" }];
  const manifest = {
    schemaVersion: "ci-research-panel/v3", releaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, supersedes: "ci-research-panel-2000-2024-v2",
    correction: "adds the exact WGI Voice and Accountability fallback required by K1 without replacing V-Dem",
    period: { start: 2000, end: 2024 }, scope: { jurisdictionStatus: "sovereign_state", jurisdictions: 194, indicators: 6, expectedRows: rows.length, observedRows: rows.filter((row) => row.valueStatus === "observed").length, missingRows: rows.filter((row) => row.valueStatus === "missing").length },
    selectionPrecedence: { democratic_quality: ["vdem:v2x_libdem", "worldbank_wgi:va.est"], rule: "use V-Dem when observed; otherwise use WGI VA; never average primary and fallback" },
    rowSha256: researchPanelHash(rows), coverageSha256: researchPanelHash(coverage), temporalBreaksSha256: researchPanelHash(temporalBreaks), generatorVersion: "ci-tournament-panel-generator/v3",
    captures: { freedomHouse: v2.manifest.freedomHouseCapture, wgi: { accessUrl: CI_PRODUCTION_SOURCE_URLS.worldbankWgi, contentSha256: WGI_SHA256, retrievedAt: "2026-07-10T20:56:16.125Z", upstreamVersion: "WGI 2025 methodology revision", redistributionPosture: "open-with-attribution" } },
    seriesType: "current_harmonized_backcast_not_as_published", valuesLocation: "private_neon_ci_research_panel_rows", rightsPosture: "private_internal_research_only_pending_source_terms", publicBulkValuesIncluded: false,
  };
  return { rows, coverage, temporalBreaks, manifest };
}

async function main() {
  const built = await buildTournamentPanelV3();
  if (write) {
    const existing = await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}`;
    if (existing[0]?.status === "complete") { if (existing[0].row_sha256 !== built.manifest.rowSha256) throw new Error("completed v3 panel hash differs"); }
    else {
      if (!existing[0]) await sql`INSERT INTO ci_research_panel_releases (id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,generator_version,source_snapshot,rights_posture) VALUES (${CI_TOURNAMENT_PANEL_V3_RELEASE_ID},'ci-research-panel/v3','staging',2000,2024,194,6,${built.rows.length},${built.manifest.scope.observedRows},${built.manifest.scope.missingRows},${built.manifest.rowSha256},${built.manifest.coverageSha256},${built.manifest.temporalBreaksSha256},'ci-tournament-panel-generator/v3',${JSON.stringify(built.manifest.captures)}::jsonb,'private_internal_research_only_pending_source_terms')`;
      for (let i = 0; i < built.rows.length; i += 500) await sql`INSERT INTO ci_research_panel_rows (release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash) SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash" FROM jsonb_to_recordset(${JSON.stringify(built.rows.slice(i, i + 500))}::jsonb) AS x("releaseId" text,"jurisdictionId" uuid,"periodYear" integer,dimension text,"indicatorId" text,"sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,"missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" boolean,"transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,"uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,"seriesType" text,"contentHash" text) ON CONFLICT DO NOTHING`;
      const [count] = await sql`SELECT count(*)::int n FROM ci_research_panel_rows WHERE release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}`;
      if (Number(count.n) !== built.rows.length) throw new Error("stored v3 panel count differs");
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW() WHERE id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND status='staging'`;
    }
    const dir = `data/releases/${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}`; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/manifest.v3.json`, `${JSON.stringify(built.manifest, null, 2)}\n`);
    writeFileSync(`${dir}/coverage.v3.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-coverage/v3", releaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, coverage: built.coverage }, null, 2)}\n`);
    writeFileSync(`${dir}/temporal-breaks.v3.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-temporal-breaks/v3", releaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, breaks: built.temporalBreaks }, null, 2)}\n`);
  }
  console.log(JSON.stringify(built.manifest, null, 2));
}

if (process.argv[1]?.endsWith("generate-ci-tournament-panel-v3.ts")) main().catch((error) => { console.error(error); process.exit(1); });
