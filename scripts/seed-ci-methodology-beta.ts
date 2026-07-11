/**
 * Phase 5.2 — Seed the Beta methodology row.
 *
 * The CI calculation pipeline keys composite rows by `methodology_version`,
 * a foreign key to `ci_methodology_versions`. Beta scores can't be
 * inserted until that version row exists.
 *
 * Idempotent: re-running this updates the weights/notes if the row
 * already exists.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { ciMethodologyVersions } from "../src/lib/db/schema";
import { V2_WEIGHTS } from "../src/lib/ci/dimensions-v2";
import { CURRENT_CI_METHODOLOGY_VERSION } from "../src/lib/ci/current-release";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sqlClient });

async function main() {
  console.log(`Seeding ${CURRENT_CI_METHODOLOGY_VERSION} methodology row...`);

  await db
    .insert(ciMethodologyVersions)
    .values({
      id: CURRENT_CI_METHODOLOGY_VERSION,
      publishedAt: new Date("2026-07-11T12:02:00.000Z"),
      weights: V2_WEIGHTS,
      notes:
        "Research beta revision 1 — 4 governance dimensions, fixed-bound normalization, " +
        "Monte Carlo input-variation ranges (10k simulations), neutral numeric presentation, " +
        "deterministic per-jurisdiction PRNG seeds, " +
        "mandatory-dimension missing-data rules. Weights provisional " +
        "until PCA / factor analysis (Phase 5.3) confirms structure. " +
        "HDI and Stability moved out to Civica Conditions companion layer.",
    })
    .onConflictDoUpdate({
      target: ciMethodologyVersions.id,
      set: {
        weights: V2_WEIGHTS,
        notes:
          "Research beta revision 1 — 4 governance dimensions, fixed-bound normalization, " +
          "Monte Carlo input-variation ranges (10k simulations), neutral numeric presentation, " +
          "deterministic per-jurisdiction PRNG seeds, " +
          "mandatory-dimension missing-data rules. Weights provisional " +
          "until PCA / factor analysis (Phase 5.3) confirms structure. " +
          "HDI and Stability moved out to Civica Conditions companion layer.",
      },
    });

  console.log("✓ Beta methodology row written");
  console.log("  weights:", V2_WEIGHTS);
}

main().catch((err) => {
  console.error("Failed to seed Beta methodology:", err);
  process.exit(1);
});
