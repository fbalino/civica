/**
 * Civica Conditions — Human Development dimension
 *
 * Copies existing HDI rows from ci_dimension_scores into
 * civica_conditions_scores using the fixed-bound normalization from
 * the methodology spec §2.3: score × 100 (HDI is already 0–1).
 *
 * Source: UNDP Human Development Index (source_id = 'undp_hdi')
 * Dimension: human_development
 * Quarter convention: ${dataset_year}-Q4 (same as CI pipeline)
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { civicaConditionsScores, ciDimensionScores } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { markSourcesSynced } from "../src/lib/db/source-freshness";

const METHODOLOGY_VERSION = "beta";
const SOURCE_ID = "undp_hdi";
const CI_DIMENSION = "human_development";
const CONDITIONS_DIMENSION = "human_development";

async function main() {
  console.log("=== Civica Conditions — Human Development (HDI) ===\n");

  // Pull all HDI rows from ci_dimension_scores
  const ciRows = await db
    .select()
    .from(ciDimensionScores)
    .where(eq(ciDimensionScores.dimension, CI_DIMENSION));

  if (ciRows.length === 0) {
    console.log("No HDI rows found in ci_dimension_scores. Run ingest:ci first.");
    process.exit(1);
  }

  console.log(`Found ${ciRows.length} HDI rows in ci_dimension_scores.`);

  let inserted = 0;

  for (const row of ciRows) {
    // spec §2.3 fixed bound: HDI is 0–1, so score × 100 = normalized score
    const rawValue = row.rawValue ?? null;
    const normalizedScore = rawValue !== null
      ? Math.min(100, Math.max(0, rawValue * 100))
      : row.normalizedScore; // fallback to existing normalized score if no raw

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

    inserted++;
  }

  // Stamp source freshness via the single sanctioned helper — only when
  // this run actually upserted rows (AGENTS.md provenance invariant). The
  // helper applies the same `inserted > 0` gate internally.
  await markSourcesSynced(SOURCE_ID, { rowsWritten: inserted });

  console.log(`Done: ${inserted} rows upserted into civica_conditions_scores.`);
  console.log(`Dimension: ${CONDITIONS_DIMENSION} | Source: ${SOURCE_ID} | Version: ${METHODOLOGY_VERSION}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
