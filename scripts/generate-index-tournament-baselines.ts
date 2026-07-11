import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { CI_TOURNAMENT_PANEL_V3_RELEASE_ID, researchPanelHash } from "../src/lib/ci/research-panel";
import { GOVERNANCE_BASELINE_IDENTITIES, INDEX_BASELINE_IMPLEMENTATION_VERSION, runAllTournamentBaselines, type BaselinePanelObservation, type BaselineOutput } from "../src/lib/ci/tournament-baselines";
import { INDEX_TOURNAMENT_PROTOCOL_VERSION } from "../src/lib/ci/tournament-preregistration";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const write = process.argv.includes("--write");
const outputPath = "data/releases/ci-index-baselines-v3/manifest.v3.json";

function coverage(outputs: readonly BaselineOutput[]) {
  return Object.fromEntries(["development", "validation", "final_holdout"].map((split) => [split, outputs.filter((row) => row.split === split).length]));
}

export async function buildBaselineManifest() {
  const rows = await sql`
    SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",
      p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",
      p.native_max AS "nativeMax",p.is_inverted AS "isInverted"
    FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id
    WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}
      AND (p.source_id || ':' || p.indicator_id) = ANY(${[...GOVERNANCE_BASELINE_IDENTITIES]})
    ORDER BY j.iso3,p.period_year,p.source_id
  ` as unknown as BaselinePanelObservation[];
  const normalizedRows = rows.map((row) => ({ ...row, value: row.value === null ? null : Number(row.value), nativeMin: Number(row.nativeMin), nativeMax: Number(row.nativeMax) }));
  const result = runAllTournamentBaselines(normalizedRows);
  const baselines = Object.fromEntries(Object.entries(result.outputs).map(([id, outputs]) => [id, {
    rows: outputs.length,
    coverage: coverage(outputs),
    outputSha256: researchPanelHash(outputs),
    scale: [...new Set(outputs.map((row) => row.scale))],
  }]));
  return {
    schemaVersion: "civica-index-baseline-manifest/v3",
    releaseId: "ci-index-baselines-v3",
    methodVersion: INDEX_BASELINE_IMPLEMENTATION_VERSION,
    protocolVersion: INDEX_TOURNAMENT_PROTOCOL_VERSION,
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
    inputIdentities: GOVERNANCE_BASELINE_IDENTITIES,
    inputCells: rows.length,
    observedInputRows: normalizedRows.filter((row) => row.value !== null).length,
    indicatorContractHash: result.indicatorContractHash,
    baselines,
    factorModel: {
      sourceOrder: result.factorModel.sourceOrder,
      fitRows: result.factorModel.fitRows,
      iterations: result.factorModel.iterations,
      tolerance: result.factorModel.tolerance,
      modelSha256: researchPanelHash(result.factorModel),
    },
    valuesLocation: "private_reproducible_from_ci_research_panel_rows",
    publicValuesIncluded: false,
    rightsPosture: "private_internal_research_only_pending_source_terms",
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildBaselineManifest().then((manifest) => {
    if (write) {
      mkdirSync("data/releases/ci-index-baselines-v3", { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    console.log(JSON.stringify(manifest, null, 2));
  }).catch((error) => { console.error(error); process.exit(1); });
}
