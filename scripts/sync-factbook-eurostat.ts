/**
 * Phase R.11 — Eurostat sync (CLI driver).
 *
 * Thin imperative wrapper over `syncEurostat()` in
 * `src/lib/factbook/reconcile/sync-eurostat.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:eurostat
 *   npx tsx scripts/sync-factbook-eurostat.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-eurostat.ts --dataset=tipsgo10
 *   npx tsx scripts/sync-factbook-eurostat.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncEurostat } from "../src/lib/factbook/reconcile/sync-eurostat";

interface CliArgs {
  factKey?: string;
  dataset?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let dataset: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--dataset=")) {
      dataset = a.slice("--dataset=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, dataset, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.11 — Eurostat sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.dataset ? ` dataset=${args.dataset}` : ""),
  );

  const summary = await syncEurostat(db, {
    factKey: args.factKey,
    dataset: args.dataset,
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
      `  ${factKey} (${c.dataset}): ${c.written} written / ` +
        `${c.jurisdictions_with_value} EU+EFTA members with value / ` +
        `${c.observations} observations` +
        (c.skipped_non_eu_efta_member
          ? ` [non-EU+EFTA: ${c.skipped_non_eu_efta_member}]`
          : "") +
        (c.skipped_no_jurisdiction
          ? ` [unmatched ISO2: ${c.skipped_no_jurisdiction}]`
          : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.projection_rows ? ` [projections: ${c.projection_rows}]` : "") +
        (c.upstreamUpdated ? ` [updated ${c.upstreamUpdated}]` : ""),
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
  console.error("Eurostat sync failed:", err);
  process.exit(1);
});
