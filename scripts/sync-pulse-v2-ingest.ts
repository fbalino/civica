/**
 * Phase 5.5 — Pulse v2 ingestion runner.
 *
 * Calls every connector and writes to `raw_events`. Run before
 * `npm run pulse:v2:cluster`.
 *
 * Usage:
 *   npm run pulse:v2:ingest
 *   npm run pulse:v2:ingest -- --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createDb, ingestPulseV2 } from "../src/lib/pulse/v2/ingest";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = createDb();
  const start = Date.now();
  const summary = await ingestPulseV2(db, { dryRun });
  const elapsedMs = Date.now() - start;

  console.log("\nIngest summary:");
  console.log(`  mode: ${summary.dryRun ? "DRY RUN — zero writes" : "apply"}`);
  console.log("  source           fetched  planned  inserted  skipped  unmatched");
  console.log("  ---------------  -------  -------  --------  -------  ---------");
  for (const r of summary.reports) {
    const errSuffix = r.error ? `  (error: ${r.error.slice(0, 40)})` : "";
    console.log(
      `  ${r.source.padEnd(15)}  ${String(r.fetched).padStart(7)}  ${String(r.wouldWrite).padStart(7)}  ${String(r.inserted).padStart(8)}  ${String(r.skippedDuplicate).padStart(7)}  ${String(r.unmatchedCountry).padStart(9)}${errSuffix}`
    );
  }
  console.log("  ---------------  -------  -------  --------  -------  ---------");
  console.log(
    `  totals           ${String(summary.totalFetched).padStart(7)}  ${String(summary.totalWouldWrite).padStart(7)}  ${String(summary.totalInserted).padStart(8)}  ${String(summary.totalSkipped).padStart(7)}  ${String(summary.totalUnmatched).padStart(9)}`
  );
  console.log(`\nElapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
