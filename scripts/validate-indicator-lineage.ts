import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
const files = ["src/lib/ci/ingest.ts", "src/lib/ci/atomic-ingestion.ts", "scripts/ingest-ci-all.ts", "src/lib/conditions/ingest.ts", "src/lib/research/manual-writers.ts"];
const source = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));
const errors: string[] = [];
for (const field of ["indicatorId", "upstreamRelease", "artifactHash", "artifactKind", "temporalCoverage", "licenseUrl", "transformationId", "substitutionReason", "methodVersion"]) if (!Object.values(source).some((body) => body.includes(field))) errors.push(`writer contract omits ${field}`);
if (!source["scripts/ingest-ci-all.ts"].includes("source_id,indicator_id")) errors.push("atomic CI conflict identity omits source/indicator");
if (!source["src/lib/conditions/ingest.ts"].includes("civicaConditionsScores.indicatorId")) errors.push("Conditions conflict identity omits indicator");
if (!source["src/lib/research/manual-writers.ts"].includes("indicatorHistory.sourceId")) errors.push("history conflict identity omits source");
async function main() {
if (process.argv.includes("--live")) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  for (const table of ["ci_source_ingestions", "ci_dimension_scores", "civica_conditions_scores", "indicator_history"]) {
    const [row] = await sql.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE artifact_hash !~ '^[a-f0-9]{64}$' OR artifact_kind NOT IN ('publisher_bytes','normalized_batch') OR license_url NOT LIKE 'https://%' OR upstream_release='' OR temporal_coverage='' OR transformation_id='' OR method_version='')::int AS invalid FROM ${table}`, []) as Array<{ total: number; invalid: number }>;
    if (Number(row?.invalid) !== 0) errors.push(`${table} has ${row?.invalid} invalid lineage rows`);
    console.log(`${table}: ${row?.total ?? 0} rows, ${row?.invalid ?? 0} invalid`);
  }
  for (const query of [`SELECT count(*)::int AS duplicates FROM (SELECT 1 FROM ci_dimension_scores GROUP BY jurisdiction_id,dimension,quarter,methodology_version,source_id,indicator_id HAVING count(*)>1) x`, `SELECT count(*)::int AS duplicates FROM (SELECT 1 FROM civica_conditions_scores GROUP BY jurisdiction_id,dimension,quarter,methodology_version,source_id,indicator_id HAVING count(*)>1) x`, `SELECT count(*)::int AS duplicates FROM (SELECT 1 FROM indicator_history GROUP BY jurisdiction_id,indicator,year,source_id HAVING count(*)>1) x`]) {
    const [row] = await sql.query(query, []) as Array<{ duplicates: number }>;
    if (Number(row?.duplicates) !== 0) errors.push(`live source/indicator identity has ${row?.duplicates} duplicates`);
  }
}
console.log("=== DAT-033 indicator/source lineage ===");
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log(`PASS — ${process.argv.includes("--live") ? "writers and live rows" : "writer contracts"} preserve first-class source/indicator lineage.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
