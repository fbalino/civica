/**
 * Phase R.2 — IMF World Economic Outlook sync (CLI driver).
 *
 * Thin imperative wrapper over `syncImfWeo()` in
 * `src/lib/factbook/reconcile/sync-imf-weo.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:imf-weo
 *   npx tsx scripts/sync-factbook-imf-weo.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-imf-weo.ts --code=NGDP_RPCH
 *   npx tsx scripts/sync-factbook-imf-weo.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncImfWeo } from "../src/lib/factbook/reconcile/sync-imf-weo";

interface CliArgs {
  factKey?: string;
  weoCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let weoCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      weoCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, weoCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.2 — IMF WEO sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.weoCode ? ` code=${args.weoCode}` : ""),
  );

  const summary = await syncImfWeo(db, {
    factKey: args.factKey,
    weoCode: args.weoCode,
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
      `  ${factKey} (${c.weoCode}): ${c.written} written / ${c.jurisdictions_with_value} with value / ${c.observations} observations` +
        (c.forecast_rows ? ` [forecasts: ${c.forecast_rows}]` : "") +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-iso3: ${c.skipped_no_jurisdiction}]`
          : ""),
    );
  }
  if (summary.disputes) {
    console.log(
      `Disputes: ${summary.disputes.inserted} new / ${summary.disputes.skippedDuplicate} dup / ${summary.disputes.proposedTotal} proposed`,
    );
  }
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of summary.errors) console.log(`  ! ${e}`);
  }
}

main().catch((err) => {
  console.error("IMF WEO sync failed:", err);
  process.exit(1);
});
