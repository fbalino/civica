/**
 * Run the Beta (v2) CI calculation pipeline — the canonical live scoring
 * path.
 *
 * Reads existing dimension data (any methodology version), applies the
 * v2 fixed-bound normalization, runs Monte Carlo to derive the central
 * 90% input-variation range (a sensitivity summary, not a confidence
 * interval), and writes the result to ci_composite_scores under
 * methodology_version='beta'. Public reads default to Beta; the archived
 * v1.0 rows remain in the same table for reproducibility only.
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
import { decoupleAbsorbedEvents } from "../src/lib/pulse/v2/decouple";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "../src/lib/db/schema";
import { CURRENT_CI_METHODOLOGY_VERSION, SUPERSEDED_CI_VINTAGE_LABEL } from "../src/lib/ci/current-release";

async function main() {
  const db = createDb();

  // --decouple-dry-run runs the absorption check without zeroing.
  // Useful when validating the helper before next quarterly fires.
  const decoupleDryRun = process.argv.includes("--decouple-dry-run");

  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  let quarter = positional[0];
  const sims = positional[1] ? parseInt(positional[1], 10) : undefined;
  const methodologyVersion = process.argv.find((arg) => arg.startsWith("--methodology-version="))?.split("=").slice(1).join("=") ?? CURRENT_CI_METHODOLOGY_VERSION;
  const supersedesVintageLabel = process.argv.find((arg) => arg.startsWith("--supersedes="))?.split("=").slice(1).join("=") ?? SUPERSEDED_CI_VINTAGE_LABEL;

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
  const publishedVersion = methodologyVersion === "beta" ? "Beta" : methodologyVersion.replace(/^beta-r/i, "Beta-R");
  const vintageLabel = `Civica Index ${year} Q${q} (${publishedVersion})`;

  console.log(`\n=== Civica Index — Beta calculation ===`);
  console.log(`Quarter:        ${quarter}`);
  console.log(`Sims:           ${sims ?? "10,000 (default)"}`);
  console.log(`Vintage label:  ${vintageLabel}\n`);

  const summary = await calculateCompositeV2(db, quarter, {
    sims,
    vintageLabel,
    methodologyVersion,
    supersedesVintageLabel,
  });

  console.log(`\n=== Done ===`);
  console.log(`Total countries with dimension data:   ${summary.totalCountries}`);
  console.log(`Scored (full or partial):              ${summary.scored}`);
  console.log(`  Full:                                ${summary.scored - summary.partial}`);
  console.log(`  Partial:                             ${summary.partial}`);
  console.log(`Skipped (insufficient under missingness policy): ${summary.insufficient}`);

  // ── Phase 5.6: CI/Pulse double-counting prevention ────────────────
  console.log(`\n=== Decouple absorbed Pulse events ===`);
  // The CI-pipeline db handle is created without the full schema
  // generic; cast for the helper which needs schema-typed inference.
  const decouple = await decoupleAbsorbedEvents(
    db as unknown as NeonHttpDatabase<typeof schema>,
    quarter,
    {
      methodologyVersion,
      dryRun: decoupleDryRun,
    }
  );
  if (decouple.noPreviousQuarter) {
    console.log(
      "  No previous beta quarter found — first run, nothing to decouple."
    );
  } else {
    const verb = decoupleDryRun ? "would be zeroed" : "zeroed";
    console.log(
      `  (country, dim) pairs crossed threshold: ${decouple.pairsCrossed}`
    );
    console.log(`  pulse_events_v2 rows ${verb}:           ${decouple.eventsZeroed}`);
    if (Object.keys(decouple.byDimension).length) {
      for (const [dim, count] of Object.entries(decouple.byDimension)) {
        console.log(`    ${dim.padEnd(22)} ${count} pair${count === 1 ? "" : "s"}`);
      }
    }
    if (decoupleDryRun) {
      console.log(`  --decouple-dry-run: no UPDATE issued.`);
    }
  }
}

main().catch((err) => {
  console.error("Beta CI calculation failed:", err);
  process.exit(1);
});
