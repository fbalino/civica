import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_TOURNAMENT_PANEL_V3_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { K1_INPUT_IDENTITIES, K1_TOURNAMENT_CONTRACT, K1_TOURNAMENT_METHOD_VERSION, runK1TournamentCandidate, type K1PanelInput } from "../src/lib/ci/tournament-candidate-k1";
import { INDEX_TOURNAMENT_PROTOCOL_VERSION } from "../src/lib/ci/tournament-preregistration";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");
const outputDir = "data/releases/k1-current-composite-tournament-v1";

export async function buildK1TournamentManifest() {
  const rows = await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND (p.source_id || ':' || p.indicator_id)=ANY(${[...K1_INPUT_IDENTITIES]}) ORDER BY j.iso3,p.period_year,p.source_id,p.indicator_id` as unknown as K1PanelInput[];
  const normalized = rows.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value) }));
  const outputs = runK1TournamentCandidate(normalized);
  const bySplit = Object.fromEntries(["development", "validation", "final_holdout"].map((split) => [split, outputs.filter((row) => row.split === split).length]));
  const byYear = Object.fromEntries(Array.from({ length: 25 }, (_, offset) => 2000 + offset).map((year) => [year, { scored: outputs.filter((row) => row.periodYear === year).length, full: outputs.filter((row) => row.periodYear === year && row.completeness === "full").length, partial: outputs.filter((row) => row.periodYear === year && row.completeness === "partial").length }]));
  return {
    schemaVersion: "k1-tournament-candidate-manifest/v1", releaseId: "k1-current-composite-tournament-v1",
    candidateId: "K1", methodVersion: K1_TOURNAMENT_METHOD_VERSION, protocolVersion: INDEX_TOURNAMENT_PROTOCOL_VERSION,
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, contractSha256: researchPanelHash(K1_TOURNAMENT_CONTRACT),
    inputCells: normalized.length, observedInputs: normalized.filter((row) => row.value !== null).length,
    outputs: { scored: outputs.length, full: outputs.filter((row) => row.completeness === "full").length, partial: outputs.filter((row) => row.completeness === "partial").length, bySplit, byYear, outputSha256: researchPanelHash(outputs) },
    uncertainty: { lowerUpperPublished: false, covarianceModel: "not_available", status: "not_estimable_without_retained_source_uncertainty_and_dependence" },
    valuesLocation: "private_reproducible_from_ci_research_panel_rows", publicValuesIncluded: false,
    rightsPosture: "private_internal_research_only_pending_source_terms",
  };
}

async function main() {
  const manifest = await buildK1TournamentManifest();
  if (write) { mkdirSync(outputDir, { recursive: true }); writeFileSync(`${outputDir}/manifest.v1.json`, `${JSON.stringify(manifest, null, 2)}\n`); }
  console.log(JSON.stringify(manifest, null, 2));
}
if (process.argv[1]?.endsWith("generate-k1-tournament-candidate.ts")) main().catch((error) => { console.error(error); process.exit(1); });
