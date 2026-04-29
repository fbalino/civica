/**
 * Phase 5.2 — Run the Beta CI calculation pipeline.
 *
 * Reads existing dimension data (any methodology version), applies the
 * v2 fixed-bound normalization, runs Monte Carlo to derive confidence
 * intervals, and writes the result to ci_composite_scores under
 * methodology_version='beta'. Live displays still show v1.0 — the
 * Beta rows just sit alongside until cut-over (Phase 5.4).
 *
 * Usage:
 *   tsx scripts/calculate-ci-v2.ts                    # latest quarter
 *   tsx scripts/calculate-ci-v2.ts 2023-Q4            # specific quarter
 *   tsx scripts/calculate-ci-v2.ts 2023-Q4 1000       # 1k sims (default 10k)
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createDb } from "../src/lib/ci/ingest";
import { calculateCompositeV2, latestQuarter } from "../src/lib/ci/calculate-v2";

async function main() {
  const db = createDb();

  let quarter = process.argv[2];
  const sims = process.argv[3] ? parseInt(process.argv[3], 10) : undefined;

  if (!quarter) {
    quarter = (await latestQuarter(db)) ?? "";
    if (!quarter) {
      console.error("No dimension data found. Run an ingest first.");
      process.exit(1);
    }
    console.log(`Using latest quarter from DB: ${quarter}`);
  }

  // Vintage label is the public citation handle. Convention:
  // "Civica Index 2023 Q4 (Beta)".
  const [year, q] = quarter.split("-Q");
  const vintageLabel = `Civica Index ${year} Q${q} (Beta)`;

  console.log(`\n=== Civica Index — Beta calculation ===`);
  console.log(`Quarter:        ${quarter}`);
  console.log(`Sims:           ${sims ?? "10,000 (default)"}`);
  console.log(`Vintage label:  ${vintageLabel}\n`);

  const summary = await calculateCompositeV2(db, quarter, {
    sims,
    vintageLabel,
  });

  console.log(`\n=== Done ===`);
  console.log(`Total countries with dimension data:   ${summary.totalCountries}`);
  console.log(`Scored (full or partial):              ${summary.scored}`);
  console.log(`  Full:                                ${summary.scored - summary.partial}`);
  console.log(`  Partial:                             ${summary.partial}`);
  console.log(`Skipped (insufficient mandatory dims): ${summary.insufficient}`);
}

main().catch((err) => {
  console.error("Beta CI calculation failed:", err);
  process.exit(1);
});
