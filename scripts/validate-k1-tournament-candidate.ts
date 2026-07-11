import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CURRENT_CI_METHODOLOGY_VERSION, CURRENT_CI_QUARTER } from "../src/lib/ci/current-release";
import { researchPanelHash } from "../src/lib/ci/research-panel";
import { K1_TOURNAMENT_CONTRACT, runK1TournamentCandidate, type K1PanelInput } from "../src/lib/ci/tournament-candidate-k1";
import { buildK1TournamentManifest } from "./generate-k1-tournament-candidate";

config({ path: ".env.local" });
const live = process.argv.includes("--live");
const checked = JSON.parse(readFileSync("data/releases/k1-current-composite-tournament-v1/manifest.v1.json", "utf8"));
const errors: string[] = [];
if (checked.contractSha256 !== researchPanelHash(K1_TOURNAMENT_CONTRACT)) errors.push("K1 contract drifted");
if (checked.publicValuesIncluded !== false || checked.uncertainty?.lowerUpperPublished !== false) errors.push("K1 publishes restricted values or unsupported uncertainty");
if (!/^[a-f0-9]{64}$/.test(checked.outputs?.outputSha256)) errors.push("K1 output hash invalid");

async function main() {
  if (live) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
    const reproduced = await buildK1TournamentManifest();
    if (JSON.stringify(reproduced) !== JSON.stringify(checked)) errors.push("longitudinal K1 manifest does not reproduce");
    const sql = neon(process.env.DATABASE_URL);
    const dimensions = await sql`SELECT d.jurisdiction_id::text AS "jurisdictionId",j.iso3,2024 AS "periodYear",d.dimension,d.source_id AS "sourceId",d.indicator_id AS "indicatorId",d.raw_value AS value FROM ci_dimension_scores d JOIN jurisdictions j ON j.id=d.jurisdiction_id WHERE d.quarter=${CURRENT_CI_QUARTER} AND d.methodology_version=${CURRENT_CI_METHODOLOGY_VERSION} ORDER BY j.iso3,d.dimension,d.source_id,d.indicator_id` as unknown as K1PanelInput[];
    const actual = await sql`SELECT c.jurisdiction_id::text AS "jurisdictionId",j.iso3,c.score::int,c.rank::int,c.completeness_flag AS completeness,c.dimensions_available::int AS "dimensionsAvailable",c.missing_dimensions AS "missingDimensions" FROM ci_composite_scores c JOIN jurisdictions j ON j.id=c.jurisdiction_id WHERE c.quarter=${CURRENT_CI_QUARTER} AND c.methodology_version=${CURRENT_CI_METHODOLOGY_VERSION} ORDER BY j.iso3` as Array<Record<string, unknown>>;
    const candidate = runK1TournamentCandidate(dimensions.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) })));
    const byIso3 = new Map(candidate.map((row) => [row.iso3, row]));
    if (candidate.length !== actual.length) errors.push(`current release row count differs: ${candidate.length}/${actual.length}`);
    for (const row of actual) {
      const found = byIso3.get(String(row.iso3));
      if (!found || found.scoreInteger !== Number(row.score) || found.rank !== Number(row.rank) || found.completeness !== row.completeness || found.dimensionsAvailable !== Number(row.dimensionsAvailable) || JSON.stringify(found.missingDimensions) !== JSON.stringify(row.missingDimensions ?? [])) errors.push(`current release mismatch for ${row.iso3}`);
    }
  }
  if (errors.length) { console.error(errors.slice(0, 25).map((error) => `FAIL — ${error}`).join("\n")); process.exit(1); }
  console.log(`PASS — K1 contract and private manifest close${live ? "; every current released score, completeness flag, missing set, and rank reproduces exactly" : ""}.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
