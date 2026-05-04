/**
 * Phase R.7 — OECD.Stat sync (CLI driver).
 *
 * Thin imperative wrapper over `syncOecdStat()` in
 * `src/lib/factbook/reconcile/sync-oecd-stat.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:oecd-stat
 *   npx tsx scripts/sync-factbook-oecd-stat.ts --fact=fiscal_balance_pct_gdp
 *   npx tsx scripts/sync-factbook-oecd-stat.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncOecdStat } from "../src/lib/factbook/reconcile/sync-oecd-stat";

interface CliArgs {
  factKey?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.7 — OECD.Stat sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : ""),
  );

  const summary = await syncOecdStat(db, {
    factKey: args.factKey,
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
      `  ${factKey} (${c.agency}/${c.dataflowId}): ${c.written} written / ` +
        `${c.jurisdictions_with_value} OECD members with value / ` +
        `${c.observations} observations` +
        (c.skipped_non_oecd_member
          ? ` [non-OECD-member: ${c.skipped_non_oecd_member}]`
          : "") +
        (c.skipped_no_jurisdiction
          ? ` [unmatched ISO3: ${c.skipped_no_jurisdiction}]`
          : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.forecast_rows ? ` [forecasts: ${c.forecast_rows}]` : ""),
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
  console.error("OECD.Stat sync failed:", err);
  process.exit(1);
});
