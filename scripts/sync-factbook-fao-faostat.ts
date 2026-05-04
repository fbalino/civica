/**
 * Phase R.8 — FAO FAOSTAT sync (CLI driver).
 *
 * Thin imperative wrapper over `syncFaoFaostat()` in
 * `src/lib/factbook/reconcile/sync-fao-faostat.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:fao-faostat
 *   npx tsx scripts/sync-factbook-fao-faostat.ts --fact=agricultural_land_pct
 *   npx tsx scripts/sync-factbook-fao-faostat.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncFaoFaostat } from "../src/lib/factbook/reconcile/sync-fao-faostat";

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
    `Phase R.8 — FAO FAOSTAT sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : ""),
  );

  const summary = await syncFaoFaostat(db, {
    factKey: args.factKey,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Vintage label:     ${summary.vintageLabel}`);
  console.log(
    `Archive bytes:     ${(summary.archiveBytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (FAO ${c.itemCode}/${c.elementCode}): ${c.written} written / ` +
        `${c.jurisdictions_with_value} ISO3 with value / ` +
        `${c.observations} observations` +
        (c.skipped_no_iso3
          ? ` [non-ISO3 aggregates: ${c.skipped_no_iso3}]`
          : "") +
        (c.skipped_no_jurisdiction
          ? ` [unmatched ISO3: ${c.skipped_no_jurisdiction}]`
          : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
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
  console.error("FAO FAOSTAT sync failed:", err);
  process.exit(1);
});
