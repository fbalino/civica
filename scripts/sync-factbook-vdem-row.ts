/**
 * Phase F.2.1 — V-Dem Regimes of the World sync.
 *
 * Pulls V-Dem's `v2x_regime` variable from the QoG cross-section
 * dataset (the same path `ingest-government-taxonomy-br.ts` uses
 * for BR/CGV — single CSV, one row per country, latest year).
 *
 * The variable maps integer codes 0–3 to the four RoW buckets
 * per Lührmann, Tannenberg & Lindberg (2018):
 *   0 → Closed Autocracy
 *   1 → Electoral Autocracy
 *   2 → Electoral Democracy
 *   3 → Liberal Democracy
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §2 (allowlist Tier 1)
 * Resolution:  ~/Downloads/resolution\ \(2\).md (peer-grouping taxonomy)
 *
 * Usage:
 *   npm run sync:factbook:vdem-row
 *   npx tsx scripts/sync-factbook-vdem-row.ts --dry-run
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncVdemRow } from "../src/lib/factbook/reconcile/sync-classifications";

interface CliArgs {
  dryRun: boolean;
}
function parseArgs(): CliArgs {
  return { dryRun: process.argv.slice(2).includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(
    `Phase F.2.1 — V-Dem Regimes of the World sync${dryRun ? " (DRY RUN)" : ""}`
  );

  const summary = await syncVdemRow(db, {
    dryRun,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const elapsed = (summary.durationMs / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  Jurisdictions matched:  ${summary.jurisdictionsMatched}`);
  console.log(`  Rows written:           ${summary.rowsWritten}`);
  console.log(`  Skipped (no iso3):      ${summary.skippedNoIso3}`);
  console.log(`  Skipped (no v2x_regime): ${summary.skippedNoData}`);
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
