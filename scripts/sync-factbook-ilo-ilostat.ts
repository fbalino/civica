/**
 * Phase R.10 — ILO ILOSTAT sync (CLI driver).
 *
 * Thin imperative wrapper over `syncIloIlostat()` in
 * `src/lib/factbook/reconcile/sync-ilo-ilostat.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:ilo-ilostat
 *   npx tsx scripts/sync-factbook-ilo-ilostat.ts --fact=unemployment_rate_pct
 *   npx tsx scripts/sync-factbook-ilo-ilostat.ts --code=UNE_2EAP_SEX_AGE_RT_A
 *   npx tsx scripts/sync-factbook-ilo-ilostat.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncIloIlostat } from "../src/lib/factbook/reconcile/sync-ilo-ilostat";

interface CliArgs {
  factKey?: string;
  iloCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let iloCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      iloCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, iloCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.10 — ILO ILOSTAT sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.iloCode ? ` code=${args.iloCode}` : ""),
  );

  const summary = await syncIloIlostat(db, {
    factKey: args.factKey,
    iloCode: args.iloCode,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Vintage labels:    ${JSON.stringify(summary.vintageLabels)}`);
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.iloCode}): ${c.written} written / ${c.jurisdictions_with_value} with value / ${c.observations} observations` +
        (c.projection_rows ? ` [projections: ${c.projection_rows}]` : "") +
        (c.imputation_rows ? ` [imputations: ${c.imputation_rows}]` : "") +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-iso3: ${c.skipped_no_jurisdiction}]`
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
  console.error("ILO ILOSTAT sync failed:", err);
  process.exit(1);
});
