/**
 * Phase R.17 — Statistics Canada (StatCan) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncStatCanCa()` in
 * `src/lib/factbook/reconcile/sync-statcan-ca.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:statcan-ca
 *   npx tsx scripts/sync-factbook-statcan-ca.ts --fact=population_total
 *   npx tsx scripts/sync-factbook-statcan-ca.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncStatCanCa } from "../src/lib/factbook/reconcile/sync-statcan-ca";

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
    `Phase R.17 — Statistics Canada sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : ""),
  );

  const summary = await syncStatCanCa(db, {
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
      `  ${factKey} (v${c.vectorId} / ${c.productId}): ${c.written} written / ` +
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
  console.error("Statistics Canada sync failed:", err);
  process.exit(1);
});
