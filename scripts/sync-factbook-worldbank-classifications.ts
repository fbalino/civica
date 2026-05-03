/**
 * Phase F.2.1 — World Bank classification sync.
 *
 * Pulls World Bank's per-country classifications (region + income
 * group) from the public Country API and writes them to
 * `country_facts` under `world_bank_region` and
 * `world_bank_income_group` with `source_id='world_bank'`.
 *
 * The WB Country API returns one JSON document with all 200+
 * jurisdictions in a single response — no per-country roundtrip
 * needed, which means the whole sync runs in <5 seconds.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 (allowlist Tier 1)
 * Plan:        ~/civica/plan/phase-f-implementation-plan.md F.2.1
 * Resolution:  ~/Downloads/resolution\ \(2\).md (peer-grouping taxonomy)
 *
 * Usage:
 *   npm run sync:factbook:wb-classifications
 *   npx tsx scripts/sync-factbook-worldbank-classifications.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import {
  syncWorldBankClassifications,
  type WbClassificationsSummary,
} from "../src/lib/factbook/reconcile/sync-classifications";

interface CliArgs {
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  return { dryRun: process.argv.slice(2).includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(
    `Phase F.2.1 — World Bank classifications sync${dryRun ? " (DRY RUN)" : ""}`
  );

  const summary: WbClassificationsSummary = await syncWorldBankClassifications(
    db,
    {
      dryRun,
      onProgress: (line) => console.log(`  ${line}`),
    }
  );

  const elapsed = (summary.durationMs / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  Jurisdictions matched:  ${summary.jurisdictionsMatched}`);
  console.log(`  Region rows written:    ${summary.regionRowsWritten}`);
  console.log(`  Income rows written:    ${summary.incomeRowsWritten}`);
  console.log(`  Skipped (no iso3):      ${summary.skippedNoIso3}`);
  console.log(`  Skipped (no income):    ${summary.skippedNoIncome}`);
  console.log(`  Errors:                 ${summary.errors.length}`);
  if (summary.errors.length > 0) {
    summary.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
