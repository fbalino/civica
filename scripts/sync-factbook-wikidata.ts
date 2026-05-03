/**
 * Phase F.2 — Wikidata sync (CLI driver).
 *
 * Thin imperative wrapper over `syncFactbookWikidata()` in
 * src/lib/factbook/reconcile/wikidata-sync.ts. Use the library
 * form from cron/route handlers; this file is for local + CI runs.
 *
 * Usage:
 *   npm run sync:factbook:wikidata
 *   npx tsx scripts/sync-factbook-wikidata.ts --jurisdiction=nigeria
 *   npx tsx scripts/sync-factbook-wikidata.ts --fact=population_total
 *   npx tsx scripts/sync-factbook-wikidata.ts --jurisdiction=nigeria --fact=population_total
 *   npx tsx scripts/sync-factbook-wikidata.ts --dry-run
 *   npx tsx scripts/sync-factbook-wikidata.ts --limit=10
 *
 * Per AGENTS.md: stamps `sources.last_sync_at = NOW()` on success.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { syncFactbookWikidata } from "../src/lib/factbook/reconcile/wikidata-sync";

interface CliArgs {
  jurisdictionSlug?: string;
  factKey?: string;
  dryRun: boolean;
  limitJurisdictions?: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let jurisdictionSlug: string | undefined;
  let factKey: string | undefined;
  let dryRun = false;
  let limitJurisdictions: number | undefined;

  for (const a of args) {
    if (a.startsWith("--jurisdiction=")) {
      jurisdictionSlug = a.slice("--jurisdiction=".length);
    } else if (a.startsWith("--fact=")) {
      factKey = a.slice("--fact=".length);
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a.startsWith("--limit=")) {
      limitJurisdictions = parseInt(a.slice("--limit=".length), 10);
    }
  }

  return { jurisdictionSlug, factKey, dryRun, limitJurisdictions };
}

async function main() {
  const args = parseArgs();

  console.log(
    `Phase F.2 — Wikidata sync${args.dryRun ? " (DRY RUN)" : ""}` +
      (args.jurisdictionSlug
        ? ` jurisdiction=${args.jurisdictionSlug}`
        : "") +
      (args.factKey ? ` fact=${args.factKey}` : "")
  );

  const summary = await syncFactbookWikidata(db, {
    jurisdictionSlug: args.jurisdictionSlug,
    factKey: args.factKey,
    dryRun: args.dryRun,
    limitJurisdictions: args.limitJurisdictions,
    onProgress: (line) => console.log(`  ${line}`),
  });

  const elapsed = (summary.durationMs / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s.`);
  console.log(`  Per-fact counters:`);
  for (const c of Object.values(summary.factCountersByKey)) {
    console.log(
      `    ${c.factKey.padEnd(28)} considered=${c.considered}` +
        ` admitted=${c.admitted}` +
        ` rej_value=${c.rejected_no_value}` +
        ` rej_envelope=${c.rejected_envelope}` +
        ` rej_no_ref=${c.rejected_no_reference}` +
        ` rej_allowlist=${c.rejected_allowlist}` +
        ` unit_mismatch=${c.unit_mismatch}` +
        ` floor_displaced=${c.floor_displaced_preferred}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
