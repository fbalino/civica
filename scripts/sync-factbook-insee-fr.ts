/**
 * Phase R.15 — INSEE (France) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncInseeFr()` in
 * `src/lib/factbook/reconcile/sync-insee-fr.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:insee-fr
 *   npx tsx scripts/sync-factbook-insee-fr.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-insee-fr.ts --idbank=001760077
 *   npx tsx scripts/sync-factbook-insee-fr.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncInseeFr } from "../src/lib/factbook/reconcile/sync-insee-fr";

interface CliArgs {
  factKey?: string;
  idbank?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let idbank: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--idbank=")) {
      idbank = a.slice("--idbank=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, idbank, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.15 — INSEE (France) sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.idbank ? ` idbank=${args.idbank}` : ""),
  );

  const summary = await syncInseeFr(db, {
    factKey: args.factKey,
    idbank: args.idbank,
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
      `  ${factKey} (idbank ${c.idbank}): ${c.written} written / ` +
        `${c.observations} observations` +
        (c.refArea ? ` [REF_AREA=${c.refArea}]` : "") +
        (c.latestTimePeriod ? ` [latest=${c.latestTimePeriod}]` : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.rejected_no_value
          ? ` [no-value rejects: ${c.rejected_no_value}]`
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
  console.error("INSEE FR sync failed:", err);
  process.exit(1);
});
