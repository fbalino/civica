import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_PRODUCTION_SOURCE_URLS, parseFreedomHouse } from "../src/lib/ci/production-source-adapters";
import { buildIso3ByCountryNameRows, fetchBuffer } from "../src/lib/ci/source-utils";
import { CI_RESEARCH_PANEL_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");
export const CI_TOURNAMENT_PANEL_RELEASE_ID = "ci-research-panel-2000-2024-v2";
const FH_SHA256 = "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88";

interface BaseRow { jurisdictionId: string; iso3: string; name: string; periodYear: number; dimension: string; indicatorId: string; sourceId: string; sourceOwner: string; retrievalPath: string; value: number | null; valueStatus: string; missingReason: string | null; nativeUnit: string; nativeMin: number; nativeMax: number; isInverted: boolean; transformId: string; sourceVintage: string; sourceVintageStatus: string; artifactHash: string; uncertaintyStatus: string; uncertaintyLower: number | null; uncertaintyUpper: number | null; revisionStatus: string; seriesType: string }

export async function buildTournamentPanelV2() {
  const base = await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,j.name,p.period_year AS "periodYear",p.dimension,p.indicator_id AS "indicatorId",p.source_id AS "sourceId",p.source_owner AS "sourceOwner",p.retrieval_path AS "retrievalPath",p.value,p.value_status AS "valueStatus",p.missing_reason AS "missingReason",p.native_unit AS "nativeUnit",p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted",p.transform_id AS "transformId",p.source_vintage AS "sourceVintage",p.source_vintage_status AS "sourceVintageStatus",p.artifact_hash AS "artifactHash",p.uncertainty_status AS "uncertaintyStatus",p.uncertainty_lower AS "uncertaintyLower",p.uncertainty_upper AS "uncertaintyUpper",p.revision_status AS "revisionStatus",p.series_type AS "seriesType" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_RESEARCH_PANEL_RELEASE_ID} ORDER BY p.source_id,p.period_year,p.jurisdiction_id` as unknown as BaseRow[];
  if (base.length !== 24250) throw new Error(`v1 panel has ${base.length} rows, expected 24250`);
  const workbook = await fetchBuffer(CI_PRODUCTION_SOURCE_URLS.freedomHouse);
  const workbookHash = createHash("sha256").update(workbook).digest("hex");
  if (workbookHash !== FH_SHA256) throw new Error(`Freedom House workbook hash drifted: ${workbookHash}`);
  const nameMap = buildIso3ByCountryNameRows([...new Map(base.map((row) => [row.jurisdictionId, { name: row.name, iso3: row.iso3 }])).values()]);
  const fh = new Map<string, number>();
  const unmatched = new Set<string>();
  for (let year = 2006; year <= 2024; year++) {
    const parsed = parseFreedomHouse(workbook, nameMap, year);
    parsed.unmatchedCountryNames.forEach((name) => unmatched.add(name));
    for (const record of parsed.ingestion.records) fh.set(`${record.iso3}:${year}`, record.rawValue);
  }
  const rows = base.map((source) => {
    const replacement = source.sourceId === "freedom_house";
    const value = replacement ? fh.get(`${source.iso3}:${source.periodYear}`) ?? null : source.value === null ? null : Number(source.value);
    const core = {
      releaseId: CI_TOURNAMENT_PANEL_RELEASE_ID, jurisdictionId: source.jurisdictionId, periodYear: source.periodYear,
      dimension: source.dimension, indicatorId: replacement ? "pr_cl_total" : source.indicatorId, sourceId: source.sourceId,
      sourceOwner: source.sourceOwner, retrievalPath: replacement ? "publisher_bulk_download" : source.retrievalPath,
      value, valueStatus: value === null ? "missing" : "observed",
      missingReason: value !== null ? null : replacement && source.periodYear < 2006 ? "outside_comparable_series" : replacement ? "source_no_observation_for_jurisdiction_period" : source.missingReason,
      nativeUnit: replacement ? "Freedom in the World PR + CL ratings (2–14; lower is freer)" : source.nativeUnit,
      nativeMin: replacement ? 2 : Number(source.nativeMin), nativeMax: replacement ? 14 : Number(source.nativeMax), isInverted: replacement ? true : source.isInverted,
      transformId: "identity_native_scale/v1", sourceVintage: replacement ? "Freedom in the World workbook through 2024" : source.sourceVintage,
      sourceVintageStatus: replacement ? "exact_publisher_workbook_version" : source.sourceVintageStatus,
      artifactHash: replacement ? FH_SHA256 : source.artifactHash,
      uncertaintyStatus: replacement ? "no_per_country_probability_distribution_published" : source.uncertaintyStatus,
      uncertaintyLower: null, uncertaintyUpper: null, revisionStatus: source.revisionStatus, seriesType: source.seriesType,
    };
    return { ...core, contentHash: researchPanelHash(core) };
  }).sort((a, b) => `${a.sourceId}:${a.indicatorId}:${a.periodYear}:${a.jurisdictionId}`.localeCompare(`${b.sourceId}:${b.indicatorId}:${b.periodYear}:${b.jurisdictionId}`));
  const coverage = [...new Set(rows.map((row) => `${row.sourceId}:${row.indicatorId}`))].sort().map((identity) => {
    const matching = rows.filter((row) => `${row.sourceId}:${row.indicatorId}` === identity);
    return { identity, observed: matching.filter((row) => row.valueStatus === "observed").length, missing: matching.filter((row) => row.valueStatus === "missing").length };
  });
  const temporalBreaks = [
    { sourceId: "freedom_house", indicatorId: "pr_cl_total", period: "2006", treatment: "2000–2005 are outside the captured comparable ratings series; no conversion from 0–100 totals" },
    { sourceId: "freedom_house", indicatorId: "pr_cl_total", period: "2006–2024", treatment: "exact 2024 publisher workbook back-series; no total-score substitution" },
  ];
  const manifest = {
    schemaVersion: "ci-research-panel/v2", releaseId: CI_TOURNAMENT_PANEL_RELEASE_ID,
    supersedes: CI_RESEARCH_PANEL_RELEASE_ID, correction: "replaces Freedom House fh_total_score with the canonical K1 pr_cl_total input",
    period: { start: 2000, end: 2024 }, scope: { jurisdictionStatus: "sovereign_state", jurisdictions: 194, indicators: 5, expectedRows: rows.length, observedRows: rows.filter((row) => row.valueStatus === "observed").length, missingRows: rows.filter((row) => row.valueStatus === "missing").length },
    rowSha256: researchPanelHash(rows), coverageSha256: researchPanelHash(coverage), temporalBreaksSha256: researchPanelHash(temporalBreaks),
    generatorVersion: "ci-tournament-panel-generator/v2", freedomHouseCapture: { accessUrl: CI_PRODUCTION_SOURCE_URLS.freedomHouse, contentSha256: FH_SHA256, retrievedAt: "2026-07-10T20:56:16.125Z", upstreamVersion: "Freedom in the World workbook through 2024", redistributionPosture: "restricted-no-redistribution", unmatchedPublisherNames: [...unmatched].sort() },
    seriesType: "current_harmonized_backcast_not_as_published", valuesLocation: "private_neon_ci_research_panel_rows", rightsPosture: "private_internal_research_only_pending_source_terms", publicBulkValuesIncluded: false,
  };
  return { rows, coverage, temporalBreaks, manifest };
}

async function main() {
  const built = await buildTournamentPanelV2();
  if (write) {
    const existing = await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${CI_TOURNAMENT_PANEL_RELEASE_ID}`;
    if (existing[0]?.status === "complete") {
      if (existing[0].row_sha256 !== built.manifest.rowSha256) throw new Error("completed v2 panel hash differs");
    } else {
      if (!existing[0]) await sql`INSERT INTO ci_research_panel_releases (id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,generator_version,source_snapshot,rights_posture) VALUES (${CI_TOURNAMENT_PANEL_RELEASE_ID},'ci-research-panel/v2','staging',2000,2024,194,5,${built.rows.length},${built.manifest.scope.observedRows},${built.manifest.scope.missingRows},${built.manifest.rowSha256},${built.manifest.coverageSha256},${built.manifest.temporalBreaksSha256},'ci-tournament-panel-generator/v2',${JSON.stringify(built.manifest.freedomHouseCapture)}::jsonb,'private_internal_research_only_pending_source_terms')`;
      for (let i = 0; i < built.rows.length; i += 500) await sql`INSERT INTO ci_research_panel_rows (release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash) SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash" FROM jsonb_to_recordset(${JSON.stringify(built.rows.slice(i, i + 500))}::jsonb) AS x("releaseId" text,"jurisdictionId" uuid,"periodYear" integer,dimension text,"indicatorId" text,"sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,"missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" boolean,"transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,"uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,"seriesType" text,"contentHash" text) ON CONFLICT DO NOTHING`;
      const [count] = await sql`SELECT count(*)::int n FROM ci_research_panel_rows WHERE release_id=${CI_TOURNAMENT_PANEL_RELEASE_ID}`;
      if (Number(count.n) !== built.rows.length) throw new Error("stored v2 panel count differs");
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW() WHERE id=${CI_TOURNAMENT_PANEL_RELEASE_ID} AND status='staging'`;
    }
    const dir = `data/releases/${CI_TOURNAMENT_PANEL_RELEASE_ID}`; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/manifest.v2.json`, `${JSON.stringify(built.manifest, null, 2)}\n`);
    writeFileSync(`${dir}/coverage.v2.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-coverage/v2", releaseId: CI_TOURNAMENT_PANEL_RELEASE_ID, coverage: built.coverage }, null, 2)}\n`);
    writeFileSync(`${dir}/temporal-breaks.v2.json`, `${JSON.stringify({ schemaVersion: "ci-research-panel-temporal-breaks/v2", releaseId: CI_TOURNAMENT_PANEL_RELEASE_ID, breaks: built.temporalBreaks }, null, 2)}\n`);
  }
  console.log(JSON.stringify(built.manifest, null, 2));
}

if (process.argv[1]?.endsWith("generate-ci-tournament-panel-v2.ts")) main().catch((error) => { console.error(error); process.exit(1); });
