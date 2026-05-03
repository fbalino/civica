/**
 * Phase F.2.1 — Monarchy status + government_form_description.
 *
 * Both fact-keys derive from existing CIA `government_type_detail`
 * prose on `jurisdictions`. No upstream HTTP fetch — this is a
 * one-shot derivation that re-runs whenever the CIA seed
 * refreshes (i.e. very rarely, since CIA Factbook is frozen
 * Jan 2026).
 *
 *   monarchy_status            — small enum (none / constitutional /
 *                                absolute / ceremonial)
 *   government_form_description — verbatim CIA prose
 *
 * Per the 2026-05-02 peer-grouping resolution: these are
 * descriptive metadata, not analytical taxonomies. Constitutional
 * form ("is there a king?") is preserved without programmatic
 * peer-grouping.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §1.1 (Group C)
 * Resolution:  ~/Downloads/resolution\ \(2\).md
 *
 * Usage:
 *   npm run sync:factbook:monarchy
 *   npx tsx scripts/sync-factbook-monarchy-status.ts --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncMonarchyAndGovernmentForm } from "../src/lib/factbook/reconcile/sync-classifications";

interface CliArgs {
  dryRun: boolean;
}
function parseArgs(): CliArgs {
  return { dryRun: process.argv.slice(2).includes("--dry-run") };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(
    `Phase F.2.1 — Monarchy + government form sync${dryRun ? " (DRY RUN)" : ""}`
  );

  const summary = await syncMonarchyAndGovernmentForm(db, {
    dryRun,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const elapsed = (summary.durationMs / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  Jurisdictions considered:        ${summary.jurisdictionsConsidered}`);
  console.log(`  monarchy_status rows written:    ${summary.monarchyRowsWritten}`);
  console.log(`  gov_form_description rows:       ${summary.formDescriptionRowsWritten}`);
  console.log(`  Monarchy buckets:`);
  for (const [k, v] of Object.entries(summary.monarchyBuckets)) {
    console.log(`    ${k.padEnd(15)} ${v}`);
  }
  console.log(`  Errors:                          ${summary.errors.length}`);
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
