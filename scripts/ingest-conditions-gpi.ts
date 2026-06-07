/**
 * Civica Conditions — Peace & Security dimension
 *
 * Copies GPI rows from ci_dimension_scores (where dimension='stability_security')
 * into civica_conditions_scores with dimension='peace_security' (renamed per spec §2.8).
 *
 * Normalization per spec §2.3 (GPI is inverted — 1.0 = most peaceful, 5.0 = least):
 *   normalized_score = ((5.0 − raw) / 4.0) × 100
 *
 * Source: Institute for Economics & Peace — Global Peace Index (source_id = 'global_peace_index')
 * Dimension: peace_security
 * Quarter convention: ${dataset_year}-Q4
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { civicaConditionsScores, ciDimensionScores } from "../src/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { markSourcesSynced } from "../src/lib/db/source-freshness";

const METHODOLOGY_VERSION = "beta";
const SOURCE_ID = "global_peace_index";
// GPI is stored under stability_security in the CI pipeline
const CI_DIMENSION = "stability_security";
const CONDITIONS_DIMENSION = "peace_security";

function normalizeGpi(raw: number): number {
  // GPI scale 1–5, inverted: 1.0 = most peaceful (best), 5.0 = least peaceful (worst)
  // spec §2.3: ((5.0 − raw) / 4.0) × 100
  const score = ((5.0 - raw) / 4.0) * 100;
  return Math.min(100, Math.max(0, score));
}

async function main() {
  console.log("=== Civica Conditions — Peace & Security (GPI) ===\n");

  // Pull all GPI rows from ci_dimension_scores
  const ciRows = await db
    .select()
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.dimension, CI_DIMENSION),
        eq(ciDimensionScores.sourceId, SOURCE_ID)
      )
    );

  if (ciRows.length === 0) {
    console.log("No GPI rows found in ci_dimension_scores. Run ingest:ci first.");
    process.exit(1);
  }

  console.log(`Found ${ciRows.length} GPI rows in ci_dimension_scores.`);

  let upserted = 0;

  for (const row of ciRows) {
    const rawValue = row.rawValue ?? null;

    // Apply the fixed-bound inversion formula
    const normalizedScore = rawValue !== null
      ? normalizeGpi(rawValue)
      : row.normalizedScore; // fallback if raw value wasn't stored

    const quarter = row.quarter;
    const datasetYear = parseInt(quarter.split("-")[0], 10);

    await db
      .insert(civicaConditionsScores)
      .values({
        jurisdictionId: row.jurisdictionId,
        dimension: CONDITIONS_DIMENSION,
        quarter,
        normalizedScore,
        rawValue,
        sourceId: SOURCE_ID,
        datasetYear,
        methodologyVersion: METHODOLOGY_VERSION,
      })
      .onConflictDoUpdate({
        target: [
          civicaConditionsScores.jurisdictionId,
          civicaConditionsScores.dimension,
          civicaConditionsScores.quarter,
          civicaConditionsScores.methodologyVersion,
        ],
        set: {
          normalizedScore,
          rawValue,
          datasetYear,
        },
      });

    upserted++;
  }

  // Stamp source freshness via the single sanctioned helper — only when
  // this run actually upserted rows (AGENTS.md provenance invariant). The
  // helper applies the same `upserted > 0` gate internally.
  await markSourcesSynced(SOURCE_ID, { rowsWritten: upserted });

  console.log(`Done: ${upserted} rows upserted into civica_conditions_scores.`);
  console.log(`Dimension: ${CONDITIONS_DIMENSION} | Source: ${SOURCE_ID} | Version: ${METHODOLOGY_VERSION}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
