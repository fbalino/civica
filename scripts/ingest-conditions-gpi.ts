/** Civica Conditions — Peace & Security component ledger. */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { and, eq } from "drizzle-orm";

import { db } from "../src/lib/db";
import { ciDimensionScores } from "../src/lib/db/schema";
import {
  CONDITIONS_ALIGNMENT_POLICY,
  CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "../src/lib/conditions/contract";
import { writeConditionScores } from "../src/lib/conditions/ingest";

const SOURCE_ID = "global_peace_index";
const CI_DIMENSION = "stability_security";
const SOURCE_METHODOLOGY_VERSION = "v1.0";
const CONDITIONS_DIMENSION = "peace_security" as const;
const DRY_RUN = process.argv.includes("--dry-run");

function referenceYear(quarter: string): number | null {
  const match = /^(\d{4})-Q[1-4]$/.exec(quarter);
  return match ? Number(match[1]) : null;
}

function normalizeGpi(raw: number): number {
  return Math.min(100, Math.max(0, ((5 - raw) / 4) * 100));
}

function conditionRow(
  row: typeof ciDimensionScores.$inferSelect,
): ConditionScoreInput {
  const year = referenceYear(row.quarter);
  const observed = row.rawValue !== null && year !== null;
  const reason = row.rawValue === null
    ? "The copied GPI source row has no native raw value"
    : "The copied GPI source row has an invalid reference quarter";
  const component = {
    componentId: "global_peace_index" as const,
    nativeValue: observed ? row.rawValue : null,
    nativeUnit: "index_1_5_inverted",
    referenceYear: observed ? year : null,
    valueStatus: observed ? ("observed" as const) : ("missing" as const),
    valueStatusReason: observed ? null : reason,
    inclusionDecision: observed ? ("included" as const) : ("excluded_missing" as const),
    sourceId: SOURCE_ID,
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-gpi-component/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  const base = {
    jurisdictionId: row.jurisdictionId,
    dimension: CONDITIONS_DIMENSION,
    quarter: observed ? row.quarter : null,
    normalizedScore: observed ? normalizeGpi(row.rawValue!) : null,
    rawValue: observed ? row.rawValue : null,
    sourceId: SOURCE_ID,
    datasetYear: observed ? year : null,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceYear: observed ? year : null,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: observed ? ("aligned" as const) : ("missing_component" as const),
    components: [component],
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind as "publisher_bytes" | "normalized_batch",
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: "conditions-gpi-fixed-bound/v2",
    substitutionReason: row.substitutionReason,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

async function main() {
  console.log("=== Civica Conditions — Peace & Security component ledger ===\n");
  const sourceRows = await db
    .select()
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.dimension, CI_DIMENSION),
        eq(ciDimensionScores.sourceId, SOURCE_ID),
        eq(ciDimensionScores.methodologyVersion, SOURCE_METHODOLOGY_VERSION),
      ),
    );
  if (!sourceRows.length) {
    throw new Error("No GPI rows found in ci_dimension_scores. Run ingest:ci first.");
  }

  const rows = sourceRows.map(conditionRow);
  const summary = await writeConditionScores(db, rows, { dryRun: DRY_RUN });
  console.log(`${DRY_RUN ? "[DRY RUN] proposed" : "Done:"} ${summary.proposed} calculations, ${summary.written} decomposable scores, and ${DRY_RUN ? rows.length : summary.componentsWritten} component rows.`);
  console.log(`Dimension: ${CONDITIONS_DIMENSION} | Source: ${SOURCE_ID} | Version: ${CURRENT_CONDITIONS_METHODOLOGY_VERSION}`);
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
