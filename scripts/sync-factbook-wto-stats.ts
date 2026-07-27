/**
 * Phase R.12 — WTO Stats sync (CLI driver).
 *
 * Thin imperative wrapper over `syncWtoStats()` in
 * `src/lib/factbook/reconcile/sync-wto-stats.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:wto-stats
 *   npx tsx scripts/sync-factbook-wto-stats.ts --fact=exports_merchandise_usd
 *   npx tsx scripts/sync-factbook-wto-stats.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 *
 * The historical R.12 cleanup is retired from this recurring source refresh.
 * Data/schema migrations belong to the authoritative migration path.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncWtoStats } from "../src/lib/factbook/reconcile/sync-wto-stats";

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
    `Phase R.12 — WTO Stats sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : ""),
  );

  const summary = await syncWtoStats(db, {
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

  console.log("\n=== Legacy migration ===");
  console.log("Retired from recurring sync: yes");
  console.log(
    `Rows renamed now:   ${summary.legacyMigration.rowsMigrated} ` +
      `(legacy fact-keys: ${summary.legacyMigration.expectedFactKeysRemoved.join(", ")})`,
  );
  console.log(
    `WB role flipped:    ${summary.legacyMigration.rowsRoleFlipped} ` +
      `(alternate → canonical on goods+services rows)`,
  );
  console.log(
    `License tightened:  ${summary.legacyMigration.licenseTightened ? "yes" : "no recurring write"}`,
  );

  console.log("\n=== Per-fact-key ===");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.wtoIndicatorCode}): ${c.written} written / ` +
        `${c.jurisdictions_with_value} ISO3 with value / ` +
        `${c.observations} observations` +
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
      `\nDisputes: ${summary.disputes.inserted} new / ${summary.disputes.skippedDuplicate} dup / ${summary.disputes.proposedTotal} proposed`,
    );
  }
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of summary.errors) console.log(`  ! ${e}`);
  }
}

main().catch((err) => {
  console.error("WTO Stats sync failed:", err);
  process.exit(1);
});
