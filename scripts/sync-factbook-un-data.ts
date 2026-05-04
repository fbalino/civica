/**
 * Phase R.3 — UN Population Division (WPP 2024) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncUnData()` in
 * `src/lib/factbook/reconcile/sync-un-data.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:un-data
 *   npx tsx scripts/sync-factbook-un-data.ts --fact=population_total
 *   npx tsx scripts/sync-factbook-un-data.ts --vid=12
 *   npx tsx scripts/sync-factbook-un-data.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncUnData } from "../src/lib/factbook/reconcile/sync-un-data";

interface CliArgs {
  factKey?: string;
  unVarId?: number;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let unVarId: number | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--vid=")) {
      unVarId = parseInt(a.slice("--vid=".length), 10);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, unVarId, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.3 — UN Population Division (WPP 2024) sync${
      args.dryRun ? " (DRY RUN)" : ""
    }` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.unVarId ? ` vid=${args.unVarId}` : ""),
  );

  const summary = await syncUnData(db, {
    factKey: args.factKey,
    unVarId: args.unVarId,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Vintage label:     ${summary.vintageLabel}`);
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (vid=${c.unVarId}): ${c.written} written / ${c.jurisdictions_with_value} mapped / ${c.observations} fetched` +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-iso3: ${c.skipped_no_jurisdiction}]`
          : ""),
    );
  }
  if (summary.disputes) {
    console.log(`\nDispute persistence:`);
    console.log(`  jurisdictions scanned: ${summary.disputes.jurisdictionsScanned}`);
    console.log(`  pairs scanned:         ${summary.disputes.pairsScanned}`);
    console.log(`  proposed total:        ${summary.disputes.proposedTotal}`);
    console.log(`  inserted:              ${summary.disputes.inserted}`);
    console.log(`  skipped duplicates:    ${summary.disputes.skippedDuplicate}`);
  }
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of summary.errors) console.log(`  ! ${e}`);
  }
}

main().catch((err) => {
  console.error("UN data sync failed:", err);
  process.exit(1);
});
