import { config } from "dotenv";
config({ path: ".env.local" });

import { createDb, buildIso3Map } from "../src/lib/ci/ingest";
import { indicatorHistory } from "../src/lib/db/schema";
import { markSourcesSynced } from "../src/lib/db/source-freshness";
import { HISTORY_ADAPTERS } from "../src/lib/ci/history-adapters";
import type { HistoryAdapter } from "../src/lib/ci/history-adapters";
import { sql as dsql } from "drizzle-orm";

/**
 * ingest-indicator-history — backfill the long-run `indicator_history`
 * archive for the CI dimension indicators (V-Dem, WGI, HDI, Freedom House,
 * CPI). Each adapter reuses the same public source path the CI pipeline
 * uses, but pulls EVERY published year instead of the single latest vintage.
 *
 * Idempotent: upserts on (jurisdiction_id, indicator, year). Re-running
 * refreshes values without creating duplicates. Freshness is stamped via
 * `markSourcesSynced()` per source, only when that source actually wrote
 * rows this run.
 *
 * Usage:
 *   npx tsx scripts/ingest-indicator-history.ts                 # all adapters
 *   npx tsx scripts/ingest-indicator-history.ts --source vdem   # one source
 *   npx tsx scripts/ingest-indicator-history.ts --dry-run       # no writes
 */

const db = createDb();

// Neon HTTP has a per-request size ceiling; keep batches modest. Each row is
// ~10 small columns, so 1000 rows/insert is comfortably under the limit.
const BATCH_SIZE = 1000;

function parseArgs(argv: string[]): { dryRun: boolean; source: string | null } {
  let dryRun = false;
  let source: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--source") source = argv[++i] ?? null;
    else if (a.startsWith("--source=")) source = a.slice("--source=".length);
  }
  return { dryRun, source };
}

interface AdapterSummary {
  label: string;
  sourceId: string;
  indicator: string;
  fetched: number;
  written: number;
  skippedNoJurisdiction: number;
  minYear: number | null;
  maxYear: number | null;
  countries: number;
  status: "ok" | "empty" | "failed";
  error?: string;
}

async function runAdapter(
  adapter: HistoryAdapter,
  iso3Map: Map<string, string>,
  dryRun: boolean
): Promise<AdapterSummary> {
  const summary: AdapterSummary = {
    label: adapter.label,
    sourceId: adapter.sourceId,
    indicator: adapter.indicator,
    fetched: 0,
    written: 0,
    skippedNoJurisdiction: 0,
    minYear: null,
    maxYear: null,
    countries: 0,
    status: "ok",
  };

  let result;
  try {
    result = await adapter.fetch();
  } catch (err) {
    summary.status = "failed";
    summary.error = err instanceof Error ? err.message : String(err);
    return summary;
  }

  summary.fetched = result.observations.length;

  // Build the row set, mapping ISO3 → jurisdiction id and dropping
  // unmatched codes (OWID/WB carry territories Civica does not track).
  const rows: (typeof indicatorHistory.$inferInsert)[] = [];
  const seenCountries = new Set<string>();
  for (const obs of result.observations) {
    const jurisdictionId = iso3Map.get(obs.iso3.toUpperCase());
    if (!jurisdictionId) {
      summary.skippedNoJurisdiction++;
      continue;
    }
    seenCountries.add(jurisdictionId);
    summary.minYear =
      summary.minYear == null ? obs.year : Math.min(summary.minYear, obs.year);
    summary.maxYear =
      summary.maxYear == null ? obs.year : Math.max(summary.maxYear, obs.year);
    rows.push({
      jurisdictionId,
      dimension: result.dimension,
      indicator: result.indicator,
      year: obs.year,
      value: obs.value,
      nativeMin: result.nativeMin,
      nativeMax: result.nativeMax,
      isInverted: result.isInverted,
      sourceId: result.sourceId,
    });
  }
  summary.countries = seenCountries.size;

  if (rows.length === 0) {
    summary.status = summary.fetched === 0 ? "failed" : "empty";
    if (summary.status === "failed")
      summary.error = "adapter returned no observations";
    return summary;
  }

  if (dryRun) {
    summary.written = 0;
    return summary;
  }

  // Batched idempotent upsert.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db
      .insert(indicatorHistory)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          indicatorHistory.jurisdictionId,
          indicatorHistory.indicator,
          indicatorHistory.year,
        ],
        set: {
          dimension: dsql`excluded.dimension`,
          value: dsql`excluded.value`,
          nativeMin: dsql`excluded.native_min`,
          nativeMax: dsql`excluded.native_max`,
          isInverted: dsql`excluded.is_inverted`,
          sourceId: dsql`excluded.source_id`,
          updatedAt: dsql`NOW()`,
        },
      });
    summary.written += batch.length;
  }

  // Stamp freshness ONLY when this source wrote rows (the sanctioned path).
  await markSourcesSynced(result.sourceId, {
    rowsWritten: summary.written,
    dryRun,
  });

  return summary;
}

async function main() {
  const { dryRun, source } = parseArgs(process.argv.slice(2));

  const adapters = source
    ? HISTORY_ADAPTERS.filter((a) => a.sourceId === source)
    : HISTORY_ADAPTERS;

  if (adapters.length === 0) {
    console.error(
      `No adapter matches --source "${source}". Available: ${HISTORY_ADAPTERS.map(
        (a) => a.sourceId
      ).join(", ")}`
    );
    process.exit(1);
  }

  console.log("Indicator history backfill");
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`Adapters: ${adapters.map((a) => a.sourceId).join(", ")}\n`);

  const iso3Map = await buildIso3Map(db);
  console.log(`Resolved ${iso3Map.size} jurisdictions with ISO3.\n`);

  const summaries: AdapterSummary[] = [];
  for (const adapter of adapters) {
    console.log(`── ${adapter.label} ──`);
    const s = await runAdapter(adapter, iso3Map, dryRun);
    summaries.push(s);
    if (s.status === "failed") {
      console.error(`  FAILED: ${s.error}`);
    } else {
      console.log(
        `  fetched=${s.fetched} written=${s.written} countries=${s.countries} ` +
          `years=${s.minYear ?? "—"}–${s.maxYear ?? "—"} ` +
          `skipped(no-jurisdiction)=${s.skippedNoJurisdiction} [${s.status}]`
      );
    }
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  let totalWritten = 0;
  let failed = 0;
  for (const s of summaries) {
    totalWritten += s.written;
    if (s.status === "failed") failed++;
    console.log(
      `${s.sourceId.padEnd(18)} ${s.indicator.padEnd(16)} ` +
        `rows=${String(s.written).padStart(7)} ` +
        `range=${s.minYear ?? "—"}–${s.maxYear ?? "—"} [${s.status}]`
    );
  }
  console.log(`\nTotal rows written: ${totalWritten}`);
  console.log(`Finished: ${new Date().toISOString()}`);
  if (failed > 0) {
    console.error(`\n${failed} adapter(s) failed.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
