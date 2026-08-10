/**
 * EXP-029 — source-backed entity name-form sync (CLI driver).
 *
 * Thin wrapper over `syncEntityNameForms()` in
 * src/lib/i18n/name-form-sync.ts. Captures publisher-supplied monolingual
 * name forms (official names, native labels, names in native language) for
 * jurisdictions, current principal-office holders, and Wikidata-identified
 * offices. Nothing is inferred from display strings; political parties have
 * no retained publisher identity and are reported as an explicit zero scope.
 *
 * Usage:
 *   npm run sync:entity-name-forms
 *   npx tsx scripts/sync-entity-name-forms.ts --dry-run
 *
 * Freshness is stamped only by the shared `writeEntityNameForms` writer after
 * committed rows (sanctioned `markSourcesSynced` path).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { syncEntityNameForms } from "../src/lib/i18n/name-form-sync";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const summary = await syncEntityNameForms(db, {
    dryRun: DRY_RUN,
    onProgress: (line) => console.log(line),
  });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length > 0) {
    console.error(`${summary.errors.length} error(s); failing closed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Entity name-form sync failed:", err);
  process.exit(1);
});
