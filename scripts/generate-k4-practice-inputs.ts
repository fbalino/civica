import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { K4_PRACTICE_INPUT_CONTRACT, K4_PRACTICE_INDICATORS, K4_PRACTICE_TEMPORAL_BREAKS, K4_VDEM_ARCHIVE_SHA256, K4_VDEM_ARCHIVE_URL } from "../src/lib/ci/k4-practice-inputs";
import { K4_PRACTICE_PANEL_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { csvObjects, fetchBuffer, toNumber, zipEntryText } from "../src/lib/ci/source-utils";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");

type Spine = { jurisdictionId: string; iso3: string };

export async function buildK4PracticeInputs() {
  const archive = await fetchBuffer(K4_VDEM_ARCHIVE_URL);
  const archiveHash = createHash("sha256").update(archive).digest("hex");
  if (archiveHash !== K4_VDEM_ARCHIVE_SHA256) throw new Error(`V-Dem v15 archive hash drifted: ${archiveHash}`);
  const csv = zipEntryText(archive, (name) => name === K4_PRACTICE_INPUT_CONTRACT.upstream.valuesPath);
  const records = csvObjects(csv, (row) => row.includes("country_text_id") && row.includes("year"));
  const byCountryYear = new Map(records.filter((row) => Number(row.year) >= 2000 && Number(row.year) <= 2024).map((row) => [`${row.country_text_id}:${row.year}`, row]));
  const spine = await sql`SELECT id::text AS "jurisdictionId",iso3 FROM jurisdictions WHERE type='sovereign_state' AND iso3 IS NOT NULL ORDER BY iso3` as unknown as Spine[];
  if (spine.length !== 194) throw new Error(`sovereign spine has ${spine.length} rows, expected 194`);
  const aliases: Record<string, string> = { PSE: "PSX" };
  const rows = spine.flatMap((jurisdiction) => K4_PRACTICE_INDICATORS.flatMap((indicator) => Array.from({ length: 25 }, (_, offset) => {
    const periodYear = 2000 + offset;
    const record = byCountryYear.get(`${aliases[jurisdiction.iso3] ?? jurisdiction.iso3}:${periodYear}`);
    const value = toNumber(record?.[indicator.indicatorId]);
    const uncertaintyLower = value === null ? null : toNumber(record?.[indicator.uncertaintyColumns[0]]);
    const uncertaintyUpper = value === null ? null : toNumber(record?.[indicator.uncertaintyColumns[1]]);
    if (value !== null && (uncertaintyLower === null || uncertaintyUpper === null)) throw new Error(`observed ${indicator.indicatorId} lacks uncertainty for ${jurisdiction.iso3}:${periodYear}`);
    if (value !== null && (value < indicator.nativeMin || value > indicator.nativeMax)) throw new Error(`${indicator.indicatorId} value outside storage envelope: ${value}`);
    const core = {
      releaseId: K4_PRACTICE_PANEL_RELEASE_ID, jurisdictionId: jurisdiction.jurisdictionId, periodYear,
      dimension: indicator.dimension, indicatorId: indicator.indicatorId, sourceId: indicator.sourceId,
      sourceOwner: "V-Dem Institute", retrievalPath: "exact_publisher_archive",
      value, valueStatus: value === null ? "missing" : "observed", missingReason: value === null ? "source_no_observation_for_jurisdiction_period" : null,
      nativeUnit: indicator.nativeUnit, nativeMin: indicator.nativeMin, nativeMax: indicator.nativeMax, isInverted: false,
      transformId: "identity_publisher_point_estimate/v1", sourceVintage: "V-Dem Country-Year Core v15", sourceVintageStatus: "exact_publisher_archive_hash",
      artifactHash: K4_VDEM_ARCHIVE_SHA256, uncertaintyStatus: "publisher_bayesian_credible_region_retained", uncertaintyLower, uncertaintyUpper,
      revisionStatus: "revisable_current_harmonized_series", seriesType: K4_PRACTICE_INPUT_CONTRACT.seriesType,
    };
    return { ...core, contentHash: researchPanelHash(core) };
  })));
  rows.sort((a, b) => `${a.indicatorId}:${a.periodYear}:${a.jurisdictionId}`.localeCompare(`${b.indicatorId}:${b.periodYear}:${b.jurisdictionId}`));
  const unmatched = spine.filter((jurisdiction) => !Array.from({ length: 25 }, (_, offset) => byCountryYear.has(`${aliases[jurisdiction.iso3] ?? jurisdiction.iso3}:${2000 + offset}`)).some(Boolean)).map((row) => row.iso3);
  const coverage = K4_PRACTICE_INDICATORS.map((indicator) => {
    const selected = rows.filter((row) => row.indicatorId === indicator.indicatorId);
    return { indicatorId: indicator.indicatorId, expected: selected.length, observed: selected.filter((row) => row.valueStatus === "observed").length, missing: selected.filter((row) => row.valueStatus === "missing").length };
  });
  const manifest = {
    ...K4_PRACTICE_INPUT_CONTRACT, generatorVersion: "k4-practice-input-generator/v1", scope: { jurisdictionStatus: "sovereign_state", jurisdictions: spine.length, indicators: K4_PRACTICE_INDICATORS.length, years: 25, expectedRows: rows.length, observedRows: rows.filter((row) => row.valueStatus === "observed").length, missingRows: rows.filter((row) => row.valueStatus === "missing").length, unmatchedJurisdictions: unmatched },
    rowSha256: researchPanelHash(rows), coverageSha256: researchPanelHash(coverage), temporalBreaksSha256: researchPanelHash(K4_PRACTICE_TEMPORAL_BREAKS), valuesLocation: "private_neon_ci_research_panel_rows", publicValuesIncluded: false,
  };
  return { rows, coverage, manifest };
}

async function main() {
  const built = await buildK4PracticeInputs();
  if (write) {
    const existing = await sql`SELECT status,row_sha256 FROM ci_research_panel_releases WHERE id=${K4_PRACTICE_PANEL_RELEASE_ID}`;
    if (existing[0]?.status === "complete") {
      if (existing[0].row_sha256 !== built.manifest.rowSha256) throw new Error("completed K4 practice release hash differs");
    } else {
      if (!existing[0]) await sql`INSERT INTO ci_research_panel_releases (id,schema_version,status,period_start,period_end,jurisdiction_count,indicator_count,expected_rows,observed_rows,missing_rows,row_sha256,coverage_sha256,temporal_breaks_sha256,generator_version,source_snapshot,rights_posture) VALUES (${K4_PRACTICE_PANEL_RELEASE_ID},${K4_PRACTICE_INPUT_CONTRACT.schemaVersion},'staging',2000,2024,194,3,${built.rows.length},${built.manifest.scope.observedRows},${built.manifest.scope.missingRows},${built.manifest.rowSha256},${built.manifest.coverageSha256},${built.manifest.temporalBreaksSha256},'k4-practice-input-generator/v1',${JSON.stringify(K4_PRACTICE_INPUT_CONTRACT.upstream)}::jsonb,${K4_PRACTICE_INPUT_CONTRACT.rights.posture})`;
      for (let i = 0; i < built.rows.length; i += 500) await sql`INSERT INTO ci_research_panel_rows (release_id,jurisdiction_id,period_year,dimension,indicator_id,source_id,source_owner,retrieval_path,value,value_status,missing_reason,native_unit,native_min,native_max,is_inverted,transform_id,source_vintage,source_vintage_status,artifact_hash,uncertainty_status,uncertainty_lower,uncertainty_upper,revision_status,series_type,content_hash) SELECT x."releaseId",x."jurisdictionId",x."periodYear",x.dimension,x."indicatorId",x."sourceId",x."sourceOwner",x."retrievalPath",x.value,x."valueStatus",x."missingReason",x."nativeUnit",x."nativeMin",x."nativeMax",x."isInverted",x."transformId",x."sourceVintage",x."sourceVintageStatus",x."artifactHash",x."uncertaintyStatus",x."uncertaintyLower",x."uncertaintyUpper",x."revisionStatus",x."seriesType",x."contentHash" FROM jsonb_to_recordset(${JSON.stringify(built.rows.slice(i, i + 500))}::jsonb) AS x("releaseId" text,"jurisdictionId" uuid,"periodYear" integer,dimension text,"indicatorId" text,"sourceId" text,"sourceOwner" text,"retrievalPath" text,value real,"valueStatus" text,"missingReason" text,"nativeUnit" text,"nativeMin" real,"nativeMax" real,"isInverted" boolean,"transformId" text,"sourceVintage" text,"sourceVintageStatus" text,"artifactHash" text,"uncertaintyStatus" text,"uncertaintyLower" real,"uncertaintyUpper" real,"revisionStatus" text,"seriesType" text,"contentHash" text) ON CONFLICT DO NOTHING`;
      const [count] = await sql`SELECT count(*)::int n FROM ci_research_panel_rows WHERE release_id=${K4_PRACTICE_PANEL_RELEASE_ID}`;
      if (Number(count.n) !== built.rows.length) throw new Error("stored K4 practice row count differs");
      await sql`UPDATE ci_research_panel_releases SET status='complete',completed_at=NOW() WHERE id=${K4_PRACTICE_PANEL_RELEASE_ID} AND status='staging'`;
    }
    const dir = `data/releases/${K4_PRACTICE_PANEL_RELEASE_ID}`; mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/manifest.v1.json`, `${JSON.stringify(built.manifest, null, 2)}\n`);
    writeFileSync(`${dir}/coverage.v1.json`, `${JSON.stringify({ schemaVersion: "ci-k4-practice-coverage/v1", releaseId: K4_PRACTICE_PANEL_RELEASE_ID, coverage: built.coverage }, null, 2)}\n`);
    writeFileSync(`${dir}/temporal-breaks.v1.json`, `${JSON.stringify({ schemaVersion: "ci-k4-practice-temporal-breaks/v1", releaseId: K4_PRACTICE_PANEL_RELEASE_ID, breaks: K4_PRACTICE_TEMPORAL_BREAKS }, null, 2)}\n`);
  }
  console.log(JSON.stringify(built.manifest, null, 2));
}

if (process.argv[1]?.endsWith("generate-k4-practice-inputs.ts")) main().catch((error) => { console.error(error); process.exit(1); });
