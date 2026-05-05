/**
 * Phase R.13 — US Census Bureau sync (CLI driver).
 *
 * Thin imperative wrapper over `syncUsCensus()` in
 * `src/lib/factbook/reconcile/sync-us-census.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:us-census
 *   npx tsx scripts/sync-factbook-us-census.ts --fact=population_total
 *   npx tsx scripts/sync-factbook-us-census.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncUsCensus } from "../src/lib/factbook/reconcile/sync-us-census";

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
    `Phase R.13 — US Census Bureau sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : ""),
  );

  const summary = await syncUsCensus(db, {
    factKey: args.factKey,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.dataset} ${c.vintage}): ${c.written} written / ` +
        `${c.jurisdictions_with_value} with value / ` +
        `${c.observations} observations` +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.rejected_parse_error
          ? ` [parse errors: ${c.rejected_parse_error}]`
          : "") +
        (c.rejected_no_value
          ? ` [no value: ${c.rejected_no_value}]`
          : "") +
        (c.projection_rows
          ? ` [projections: ${c.projection_rows}]`
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
  console.error("US Census sync failed:", err);
  process.exit(1);
});
