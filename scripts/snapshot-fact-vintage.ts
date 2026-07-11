/**
 * Phase F.1 / R.22 — quarterly fact-vintage snapshot CLI.
 *
 * Thin wrapper around `snapshotCompleteCandidateRelease()`. The library
 * freezes every resolver input, source/input and adapter hash, offline replay
 * checksum, and immutable winner pointer. This script handles arguments; the cron route at
 * `src/app/api/cron/factbook/snapshot-vintage/route.ts` is the
 * production caller; this script is for diagnostic / manual cuts.
 *
 * Methodology: ~/civica/plan/vintage-cadence-resolution-v1.md
 *
 * Usage:
 *   # Auto-derive label from current date (post-quarter-close T+15 rule):
 *   npx tsx scripts/snapshot-fact-vintage.ts
 *
 *   # Override the label (diagnostic / smoke-test cut):
 *   npx tsx scripts/snapshot-fact-vintage.ts \
 *     --vintage="Civica Atlas Reconciled v0.3-beta — vintage 2026-Q2"
 *
 *   # Dry run (no DB writes):
 *   npx tsx scripts/snapshot-fact-vintage.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { deriveVintageLabel } from "../src/lib/factbook/reconcile/snapshot-vintage";
import { snapshotCompleteCandidateRelease } from "../src/lib/factbook/reconcile/snapshot-candidate-release";

interface CliArgs {
  vintage?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let vintage: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--vintage=")) vintage = a.slice("--vintage=".length);
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--jurisdiction=") || a.startsWith("--supersedes=")) throw new Error("Complete candidate releases cannot be partial or overwrite a prior release");
  }

  return { vintage, dryRun };
}

async function main() {
  const { vintage, dryRun } = parseArgs();
  const cutDate = new Date();

  const summary = await snapshotCompleteCandidateRelease({
    vintageLabel: vintage ?? deriveVintageLabel(cutDate, "v0.3-beta"),
    cutDate,
    dryRun,
  });

  console.log("\n=== summary ===");
  console.log(`  vintage:           ${summary.vintageLabel}`);
  console.log(`  cut_at:            ${summary.cutAt}`);
  console.log(`  candidates:        ${summary.candidateCount}`);
  console.log(`  winners:           ${summary.winnerCount}`);
  console.log(`  unchanged:         ${summary.unchanged}`);
  console.log(`  candidate checksum:${summary.candidateSetChecksum}`);
  console.log(`  winner checksum:   ${summary.winnerSetChecksum}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
