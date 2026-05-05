/**
 * Phase R.18 — IBGE (Brazil) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncIbgeBr()` in
 * `src/lib/factbook/reconcile/sync-ibge-br.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:ibge-br
 *   npx tsx scripts/sync-factbook-ibge-br.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-ibge-br.ts --table=6579
 *   npx tsx scripts/sync-factbook-ibge-br.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncIbgeBr } from "../src/lib/factbook/reconcile/sync-ibge-br";

interface CliArgs {
  factKey?: string;
  tableId?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let tableId: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--table=")) {
      tableId = a.slice("--table=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, tableId, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.18 — IBGE (Brazil) sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.tableId ? ` table=${args.tableId}` : ""),
  );

  const summary = await syncIbgeBr(db, {
    factKey: args.factKey,
    tableId: args.tableId,
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
      `  ${factKey} (table ${c.tableId} var ${c.variableId}): ${c.written} written / ` +
        `${c.observations} observation${c.observations === 1 ? "" : "s"}` +
        (c.latestPeriodCode ? ` [period=${c.latestPeriodCode}]` : "") +
        (c.latestPeriodLabel ? ` [${c.latestPeriodLabel}]` : "") +
        (c.unitMeasure ? ` [unit=${c.unitMeasure}]` : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.rejected_no_value
          ? ` [no-value rejects: ${c.rejected_no_value}]`
          : "") +
        (c.projection_rows ? ` [projections: ${c.projection_rows}]` : ""),
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
  console.error("IBGE BR sync failed:", err);
  process.exit(1);
});
