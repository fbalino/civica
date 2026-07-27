import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  normalizeIndexAnalysisInputs,
  retainProtectedIndexAnalysisInputs,
  type IndexAnalysisLongitudinalLabelRow,
  type IndexAnalysisMetadataRow,
  type IndexAnalysisPanelRow,
  type IndexAnalysisUncertaintyRow,
} from "../src/lib/ci/index-analysis-inputs";
import {
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  K1_UNCERTAINTY_INPUT_RELEASE_ID,
  LONGITUDINAL_VALIDATION_RELEASE_ID,
} from "../src/lib/ci/research-panel";

async function main() {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required to capture Index analysis inputs");
  if (!process.env.CIVICA_RESEARCH_INPUT_DIR) {
    throw new Error("CIVICA_RESEARCH_INPUT_DIR is required to capture Index analysis inputs");
  }
  const sql = neon(process.env.DATABASE_URL);
  const [panel, uncertainty, longitudinalLabels, metadata] = await Promise.all([
    sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted" FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} ORDER BY j.iso3,p.period_year,p.source_id,p.indicator_id` as unknown as Promise<IndexAnalysisPanelRow[]>,
    sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value,p.native_min AS "nativeMin",p.native_max AS "nativeMax",p.is_inverted AS "isInverted",p.uncertainty_lower AS lower,p.uncertainty_upper AS upper FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${K1_UNCERTAINTY_INPUT_RELEASE_ID} ORDER BY j.iso3,p.period_year,p.source_id,p.indicator_id` as unknown as Promise<IndexAnalysisUncertaintyRow[]>,
    sql`SELECT j.iso3,p.period_year AS year,p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${LONGITUDINAL_VALIDATION_RELEASE_ID} AND p.value_status='observed' ORDER BY j.iso3,p.period_year` as unknown as Promise<IndexAnalysisLongitudinalLabelRow[]>,
    sql`SELECT j.iso3,j.continent AS region,gt.regime_type_cgv AS regime FROM jurisdictions j LEFT JOIN LATERAL(SELECT regime_type_cgv FROM government_taxonomies g WHERE g.jurisdiction_id=j.id ORDER BY g.regime_year DESC NULLS LAST,g.updated_at DESC NULLS LAST LIMIT 1)gt ON true WHERE j.type='sovereign_state' AND j.iso3 IS NOT NULL ORDER BY j.iso3` as unknown as Promise<IndexAnalysisMetadataRow[]>,
  ]);
  const inputs = normalizeIndexAnalysisInputs({
    schemaVersion: "civica-index-analysis-inputs/v1",
    panel: panel.map((row) => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
      nativeMin: Number(row.nativeMin),
      nativeMax: Number(row.nativeMax),
      isInverted: Boolean(row.isInverted),
    })),
    uncertainty: uncertainty.map((row) => ({
      ...row,
      value: row.value === null ? null : Number(row.value),
      nativeMin: Number(row.nativeMin),
      nativeMax: Number(row.nativeMax),
      isInverted: Boolean(row.isInverted),
      lower: row.lower === null ? null : Number(row.lower),
      upper: row.upper === null ? null : Number(row.upper),
    })),
    longitudinalLabels: longitudinalLabels.map((row) => ({ ...row, value: Number(row.value) })),
    metadata,
  });
  const retained = retainProtectedIndexAnalysisInputs(inputs);
  console.log(JSON.stringify({ ...retained, counts: {
    panel: inputs.panel.length,
    uncertainty: inputs.uncertainty.length,
    longitudinalLabels: inputs.longitudinalLabels.length,
    metadata: inputs.metadata.length,
  } }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
