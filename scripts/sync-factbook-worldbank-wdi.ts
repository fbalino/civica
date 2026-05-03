/**
 * Phase F.6 — World Bank WDI sync (CLI driver).
 *
 * Thin imperative wrapper over `syncWorldBankWdi()` in
 * `src/lib/factbook/reconcile/sync-wdi.ts`. Use the library form
 * from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:wdi
 *   npx tsx scripts/sync-factbook-worldbank-wdi.ts --fact=inflation_rate
 *   npx tsx scripts/sync-factbook-worldbank-wdi.ts --code=NY.GDP.PCAP.PP.CD
 *   npx tsx scripts/sync-factbook-worldbank-wdi.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncWorldBankWdi } from "../src/lib/factbook/reconcile/sync-wdi";

interface CliArgs {
  factKey?: string;
  wbCode?: string;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let factKey: string | undefined;
  let wbCode: string | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a.startsWith("--code=")) {
      wbCode = a.slice("--code=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }

  return { factKey, wbCode, dryRun };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase F.6 — World Bank WDI sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.factKey ? ` fact=${args.factKey}` : "") +
      (args.wbCode ? ` code=${args.wbCode}` : ""),
  );

  const summary = await syncWorldBankWdi(db, {
    factKey: args.factKey,
    wbCode: args.wbCode,
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
      `  ${factKey} (${c.wbCode}): ${c.written} written / ${c.jurisdictions_with_value} with value / ${c.observations} observations` +
        (c.rejected_envelope ? ` [envelope: ${c.rejected_envelope}]` : "") +
        (c.skipped_no_jurisdiction
          ? ` [no-iso3: ${c.skipped_no_jurisdiction}]`
          : ""),
    );
  }
  if (summary.errors.length > 0) {
    console.log("\nErrors:");
    for (const e of summary.errors) console.log(`  ! ${e}`);
  }
}

main().catch((err) => {
  console.error("WDI sync failed:", err);
  process.exit(1);
});
