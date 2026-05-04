/**
 * Phase R.6 — UNDP Human Development Report (HDR) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncUndpHdi()` in
 * `src/lib/factbook/reconcile/sync-undp-hdi.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:undp-hdi
 *   npx tsx scripts/sync-factbook-undp-hdi.ts --fact=hdi_score
 *   npx tsx scripts/sync-factbook-undp-hdi.ts --code=hdi
 *   npx tsx scripts/sync-factbook-undp-hdi.ts --dry-run
 *
 * Replaces the legacy prototype `scripts/sync-undp-hdi.ts` (which
 * wrote 55 hardcoded reference rows to the dormant `country_metrics`
 * legacy table; deleted in the same R.6 commit per
 * `~/civica/plan/undp-hdi-resolution-v1.md` §2f).
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncUndpHdi } from "../src/lib/factbook/reconcile/sync-undp-hdi";

interface CliArgs {
  factKey?: string;
  undpCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let undpCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      undpCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, undpCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.6 — UNDP HDR sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.undpCode ? ` code=${args.undpCode}` : ""),
  );

  const summary = await syncUndpHdi(db, {
    factKey: args.factKey,
    undpCode: args.undpCode,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:            ${summary.startedAt}`);
  console.log(`Finished:           ${summary.finishedAt}`);
  console.log(`Duration:           ${summary.durationMs}ms`);
  console.log(`Vintage label:      ${summary.vintageLabel}`);
  console.log(`Jurisdictions:      ${summary.jurisdictionsInScope}`);
  console.log(`CSV country rows:   ${summary.csvCountryRows}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.undpCode} → '${c.csvColumn}'): ${c.written} written / ${c.jurisdictions_with_value} with value / scanned ${c.rowsScanned}` +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-jurisdiction: ${c.skipped_no_jurisdiction}]`
          : "") +
        (c.rejected_no_value
          ? ` [no-value: ${c.rejected_no_value}]`
          : ""),
    );
  }
  if (summary.disputes) {
    const d = summary.disputes;
    console.log(
      `\nDisputes (resolver-proposed):` +
        ` proposed ${d.proposedTotal},` +
        ` inserted ${d.inserted},` +
        ` deduped ${d.skippedDuplicate},` +
        ` no-factgroup ${d.skippedNoFactGroup}`,
    );
    if (d.errors.length > 0) {
      for (const e of d.errors) console.log(`  ! ${e}`);
    }
  }
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of summary.errors) console.log(`  ! ${e}`);
  }
}

main().catch((err) => {
  console.error("UNDP HDR sync failed:", err);
  process.exit(1);
});
