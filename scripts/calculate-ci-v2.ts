/**
 * Run the Beta (v2) CI calculation pipeline — the canonical live scoring
 * path.
 *
 * Reads one registered release's exact dimension set, applies its declared
 * normalization, computes the bound composite algorithm, and writes under the
 * same release coordinates. Current rows publish no generic uncertainty range.
 *
 * Usage:
 *   tsx scripts/calculate-ci-v2.ts
 *   tsx scripts/calculate-ci-v2.ts --release=ci-beta-r5-2024-Q4
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createDb } from "../src/lib/ci/ingest";
import { calculateCompositeV2 } from "../src/lib/ci/calculate-v2";
import { decoupleAbsorbedEvents } from "../src/lib/pulse/v2/decouple";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type * as schema from "../src/lib/db/schema";
import { CURRENT_CI_RELEASE_ID, SUPERSEDED_CI_VINTAGE_LABEL } from "../src/lib/ci/current-release";
import { resolveCiRelease } from "../src/lib/ci/release-selection";

async function main() {
  const db = createDb();

  // --decouple-dry-run runs the absorption check without zeroing.
  // Useful when validating the helper before next quarterly fires.
  const decoupleDryRun = process.argv.includes("--decouple-dry-run");

  const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const releaseId = process.argv.find((arg) => arg.startsWith("--release="))?.split("=").slice(1).join("=") ?? CURRENT_CI_RELEASE_ID;
  const release = resolveCiRelease(releaseId);
  const quarter = positional[0] ?? release.quarter;
  const methodologyVersion = release.methodologyVersion;
  const supersedesVintageLabel = process.argv.find((arg) => arg.startsWith("--supersedes="))?.split("=").slice(1).join("=") ?? SUPERSEDED_CI_VINTAGE_LABEL;

  if (quarter !== release.quarter) throw new Error(`${release.releaseId} does not contain ${quarter}`);
  const vintageLabel = release.vintageLabel;

  console.log(`\n=== Civica Index — Beta calculation ===`);
  console.log(`Quarter:        ${quarter}`);
  console.log("Randomization:  none");
  console.log(`Vintage label:  ${vintageLabel}\n`);

  const summary = await calculateCompositeV2(db, quarter, {
    vintageLabel,
    methodologyVersion,
    releaseId: release.releaseId,
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
