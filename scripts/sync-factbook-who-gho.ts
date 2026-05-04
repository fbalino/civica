/**
 * Phase R.4 — WHO Global Health Observatory sync (CLI driver).
 *
 * Thin imperative wrapper over `syncWhoGho()` in
 * `src/lib/factbook/reconcile/sync-who-gho.ts`. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:who-gho
 *   npx tsx scripts/sync-factbook-who-gho.ts --fact=life_expectancy_years
 *   npx tsx scripts/sync-factbook-who-gho.ts --code=WHOSIS_000001
 *   npx tsx scripts/sync-factbook-who-gho.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncWhoGho } from "../src/lib/factbook/reconcile/sync-who-gho";

interface CliArgs {
  factKey?: string;
  whoCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let whoCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      whoCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, whoCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase R.4 — WHO GHO sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.whoCode ? ` code=${args.whoCode}` : ""),
  );

  const summary = await syncWhoGho(db, {
    factKey: args.factKey,
    whoCode: args.whoCode,
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
      `  ${factKey} (${c.whoCode}): ${c.written} written / ${c.jurisdictions_with_value} with value / ${c.observations} observations` +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-iso3: ${c.skipped_no_jurisdiction}]`
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
  console.error("WHO GHO sync failed:", err);
  process.exit(1);
});
