/**
 * Phase R.14 — ONS-UK sync (CLI driver).
 *
 * Thin imperative wrapper over `syncOnsUk()` in
 * `src/lib/factbook/reconcile/sync-ons-uk.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:ons-uk
 *   npx tsx scripts/sync-factbook-ons-uk.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-ons-uk.ts --cdid=UKPOP
 *   npx tsx scripts/sync-factbook-ons-uk.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncOnsUk } from "../src/lib/factbook/reconcile/sync-ons-uk";

interface CliArgs {
  factKey?: string;
  cdid?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let cdid: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--cdid=")) {
      cdid = a.slice("--cdid=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, cdid, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.14 — ONS-UK sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.cdid ? ` cdid=${args.cdid}` : ""),
  );

  const summary = await syncOnsUk(db, {
    factKey: args.factKey,
    cdid: args.cdid,
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
  console.log(`Source row inserted: ${summary.sourceRowInserted}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.cdid}): ${c.written} written / ` +
        `${c.observations} annual observations` +
        (c.rejected_no_value
          ? ` [empty cells: ${c.rejected_no_value}]`
          : "") +
        (c.rejected_envelope
          ? ` [envelope rejects: ${c.rejected_envelope}]`
          : "") +
        (c.projection_rows ? ` [projections: ${c.projection_rows}]` : "") +
        (c.upstreamReleaseDate
          ? ` [released ${c.upstreamReleaseDate}]`
          : "") +
        (c.pickedYear !== null && c.pickedValue !== null
          ? ` — picked ${c.pickedYear} = ${c.pickedValue}`
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
  console.error("ONS-UK sync failed:", err);
  process.exit(1);
});
