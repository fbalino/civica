/**
 * Phase R.19 — Stats SA (South Africa) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncStatsSa()` in
 * `src/lib/factbook/reconcile/sync-stats-sa.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:stats-sa
 *   npx tsx scripts/sync-factbook-stats-sa.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-stats-sa.ts --pcode=P0141
 *   npx tsx scripts/sync-factbook-stats-sa.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 *
 * Per resolution §7b (Q5 user override): extraction failures are
 * graceful no-ops. The script exits 0 when the sync runs to
 * completion even if some indicators were skipped due to
 * extraction issues; check the per-fact-key counters and the
 * errors[] log to see what was skipped.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncStatsSa } from "../src/lib/factbook/reconcile/sync-stats-sa";

interface CliArgs {
  factKey?: string;
  pCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let pCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--pcode=")) {
      pCode = a.slice("--pcode=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, pCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.19 — Stats SA (South Africa) sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.pCode ? ` pcode=${args.pCode}` : ""),
  );

  const summary = await syncStatsSa(db, {
    factKey: args.factKey,
    pCode: args.pCode,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Vintage label:     ${summary.vintageLabel}`);
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Source row inserted: ${summary.sourceRowInserted}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.pCode}): ${c.written} written` +
        (c.pdfUrl ? ` [pdf=${c.pdfUrl}]` : "") +
        (c.pdfBytes ? ` [bytes=${c.pdfBytes}]` : "") +
        (c.latestPeriodLabel ? ` [period="${c.latestPeriodLabel}"]` : "") +
        (c.pickedValue !== null ? ` [value=${c.pickedValue}]` : "") +
        (c.rejected_no_pdf
          ? ` [no-pdf rejects: ${c.rejected_no_pdf}]`
          : "") +
        (c.rejected_extraction
          ? ` [extraction rejects: ${c.rejected_extraction}]`
          : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.rejected_sanity
          ? ` [sanity rejects: ${c.rejected_sanity}]`
          : "") +
        (c.rejected_quote_mismatch
          ? ` [quote-mismatch rejects: ${c.rejected_quote_mismatch}]`
          : "") +
        (c.projection_rows ? ` [projections: ${c.projection_rows}]` : ""),
    );
    if (c.rawQuote) {
      console.log(`      rawQuote: ${c.rawQuote.slice(0, 140)}…`);
    }
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
  console.error("Stats SA sync failed:", err);
  process.exit(1);
});
