import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_TOURNAMENT_PANEL_V3_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { K2_CONCORDANCE_CONTRACT, K2_CONCORDANCE_METHOD_VERSION, K2_RATERS, k2DevelopmentDiagnostics, runK2Concordance, type K2PanelInput } from "../src/lib/ci/tournament-candidate-k2";
import { INDEX_TOURNAMENT_PROTOCOL_VERSION } from "../src/lib/ci/tournament-preregistration";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL); const write = process.argv.includes("--write");
export async function buildK2ConcordanceManifest() {
  const rows = await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND (p.source_id || ':' || p.indicator_id)=ANY(${[...K2_RATERS]}) ORDER BY p.period_year,j.iso3,p.source_id,p.indicator_id` as unknown as K2PanelInput[];
  const outputs = runK2Concordance(rows.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value), nativeMin: Number(row.nativeMin), nativeMax: Number(row.nativeMax) })));
  const diagnostics = k2DevelopmentDiagnostics(outputs);
  return { schemaVersion: "k2-concordance-prototype-manifest/v1", releaseId: "k2-concordance-prototype-v1", candidateId: "K2", methodVersion: K2_CONCORDANCE_METHOD_VERSION, protocolVersion: INDEX_TOURNAMENT_PROTOCOL_VERSION, panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID, contractSha256: researchPanelHash(K2_CONCORDANCE_CONTRACT), inputCells: rows.length, outputs: { total: outputs.length, development: outputs.filter((row) => row.split === "development").length, validation: outputs.filter((row) => row.split === "validation").length, finalHoldout: outputs.filter((row) => row.split === "final_holdout").length, outputSha256: researchPanelHash(outputs) }, developmentDiagnostics: diagnostics, confirmatoryHoldoutInspected: false, expertKnownCaseStatus: "pending_external_expert_list", withinSourceUncertainty: "not_retained", valuesLocation: "private_reproducible_from_ci_research_panel_rows", publicValuesIncluded: false, rightsPosture: "private_internal_research_only_pending_source_terms" };
}
async function main() { const manifest = await buildK2ConcordanceManifest(); if (write) { mkdirSync("data/releases/k2-concordance-prototype-v1", { recursive: true }); writeFileSync("data/releases/k2-concordance-prototype-v1/manifest.v1.json", `${JSON.stringify(manifest, null, 2)}\n`); } console.log(JSON.stringify(manifest, null, 2)); }
if (process.argv[1]?.endsWith("generate-k2-concordance-prototype.ts")) main().catch((error) => { console.error(error); process.exit(1); });
