/**
 * Phase F.1 / R.22 — quarterly fact-vintage snapshot CLI.
 *
 * Thin wrapper around `snapshotCurrentVintage()` from
 * `src/lib/factbook/reconcile/snapshot-vintage.ts`. The library
 * does all the work; this script handles arg parsing + log
 * output. The cron route at
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
 *     --vintage="Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1"
 *
 *   # Restrict to one jurisdiction:
 *   npx tsx scripts/snapshot-fact-vintage.ts --jurisdiction=argentina
 *
 *   # Dry run (no DB writes):
 *   npx tsx scripts/snapshot-fact-vintage.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { snapshotCurrentVintage } from "../src/lib/factbook/reconcile/snapshot-vintage";

interface CliArgs {
  vintage?: string;
  dryRun: boolean;
  jurisdictionSlug?: string;
  supersedesVintageLabel?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let vintage: string | undefined;
  let dryRun = false;
  let jurisdictionSlug: string | undefined;
  let supersedesVintageLabel: string | undefined;

  for (const a of args) {
    if (a.startsWith("--vintage=")) vintage = a.slice("--vintage=".length);
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--jurisdiction=")) {
      jurisdictionSlug = a.slice("--jurisdiction=".length);
    }
    else if (a.startsWith("--supersedes=")) {
      supersedesVintageLabel = a.slice("--supersedes=".length);
    }
  }

  return { vintage, dryRun, jurisdictionSlug, supersedesVintageLabel };
}

async function main() {
  const { vintage, dryRun, jurisdictionSlug, supersedesVintageLabel } = parseArgs();

  const summary = await snapshotCurrentVintage({
    vintageLabel: vintage,
    jurisdictionSlug,
    supersedesVintageLabel,
    dryRun,
    onProgress: (line) => {
      if (line.startsWith("!")) console.error(line);
      else console.log(line);
    },
  });

  console.log("\n=== summary ===");
  console.log(`  vintage:           ${summary.vintageLabel}`);
  console.log(`  cut_at:            ${summary.cutAt}`);
  console.log(`  scanned:           ${summary.scanned}`);
  console.log(`  snapshotted:       ${summary.snapshotted}`);
  console.log(`  unchanged:         ${summary.unchanged}`);
  console.log(`  skipped (no key):  ${summary.skippedNoFactKey}`);
  console.log(`  skipped (no can.): ${summary.skippedNoCanonical}`);
  console.log(`  errors:            ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    for (const e of summary.errors) {
      console.error(`  ! ${e.jurisdictionSlug}/${e.factKey}: ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
