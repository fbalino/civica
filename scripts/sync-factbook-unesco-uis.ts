/**
 * Phase R.5 — UNESCO Institute for Statistics (UIS) sync (CLI driver).
 *
 * Thin imperative wrapper over `syncUnescoUis()` in
 * `src/lib/factbook/reconcile/sync-unesco-uis.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:unesco-uis
 *   npx tsx scripts/sync-factbook-unesco-uis.ts --fact=literacy_rate
 *   npx tsx scripts/sync-factbook-unesco-uis.ts --code=LR.AG15T99
 *   npx tsx scripts/sync-factbook-unesco-uis.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 * Also corrects the seeded `sources.license` value from
 * `CC-BY-3.0-IGO` to `CC-BY-SA-4.0` per resolution Q1.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncUnescoUis } from "../src/lib/factbook/reconcile/sync-unesco-uis";

interface CliArgs {
  factKey?: string;
  uisCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let uisCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      uisCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, uisCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.5 — UNESCO UIS sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.uisCode ? ` code=${args.uisCode}` : ""),
  );

  const summary = await syncUnescoUis(db, {
    factKey: args.factKey,
    uisCode: args.uisCode,
    dryRun: args.dryRun,
    onProgress: (line) => console.log(line),
  });

  console.log("\n=== Summary ===");
  console.log(`Started:           ${summary.startedAt}`);
  console.log(`Finished:          ${summary.finishedAt}`);
  console.log(`Duration:          ${summary.durationMs}ms`);
  console.log(`Vintage label:     ${summary.vintageLabel}`);
  console.log(`Version handle:    ${summary.versionHandle ?? "(fallback)"}`);
  console.log(`Jurisdictions:     ${summary.jurisdictionsInScope}`);
  console.log(`Total rows written: ${summary.totalWritten}`);
  console.log("Per-fact-key:");
  for (const [factKey, c] of Object.entries(summary.countersByFactKey)) {
    console.log(
      `  ${factKey} (${c.uisCode}): ${c.written} written / ${c.jurisdictions_with_value} ISO3 with value / ${c.observations} observations` +
        (c.uis_estimates ? ` [UIS_EST: ${c.uis_estimates}]` : "") +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_iso3 ? ` [aggregates: ${c.skipped_no_iso3}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-jurisdiction: ${c.skipped_no_jurisdiction}]`
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
  console.error("UNESCO UIS sync failed:", err);
  process.exit(1);
});
