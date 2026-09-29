/**
 * Phase 5.5 — Pulse v2 ingestion runner.
 *
 * Calls every connector and writes to `raw_events`. Run before
 * `npm run pulse:v2:cluster`.
 *
 * Usage:
 *   npm run pulse:v2:ingest
 *   npm run pulse:v2:ingest -- --dry-run
 *   npm run pulse:v2:ingest -- --connectors=gdelt
 *
 * The owner-Mac runner retrieves GDELT this way (PUL-044). A run in which
 * any retrieved connector fails exits nonzero, so the runner and the
 * production pipeline ledger record it as failed.
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { createDb, ingestPulseV2 } from "../src/lib/pulse/v2/ingest";

function connectorsArg(argv: readonly string[]): string[] | undefined {
  const arg = argv.find((value) => value.startsWith("--connectors="));
  if (!arg) return undefined;
  const ids = arg
    .slice("--connectors=".length)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) throw new Error("--connectors needs at least one connector id");
  return ids;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyConnectors = connectorsArg(process.argv);
  const db = createDb();
  const start = Date.now();
  const summary = await ingestPulseV2(db, { dryRun, onlyConnectors });
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
  // Counter lines read by scripts/run-observed-production-pipeline.ts.
  console.log(`rows: ${summary.totalFetched}`);
  console.log(`inserted: ${summary.totalInserted}`);
  console.log(`rejected: ${summary.totalUnmatched}`);
  console.log(`\nElapsed: ${(elapsedMs / 1000).toFixed(1)}s`);

  const failed = summary.reports.filter((report) => report.error !== undefined);
  if (failed.length) {
    console.error(
      `Connector failure: ${failed.map((report) => report.source).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
