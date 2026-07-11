import { countryMetrics } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";

type Db = typeof import("@/lib/db").db;
export interface CountryMetricInput { jurisdictionId: string; metricId: string; year: number; value: number; rank?: number; totalRanked?: number; sourceId: string; sourceUrl: string | null }

export async function writeCountryMetrics(db: Db, rows: CountryMetricInput[], options: { dryRun?: boolean; stampFreshness?: boolean; markSynced?: typeof markSourcesSynced } = {}) {
  if (rows.length === 0) throw new Error("Country metrics input produced zero rows");
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.jurisdictionId}:${row.metricId}:${row.year}`;
    if (keys.has(key)) throw new Error(`Duplicate country metric: ${key}`);
    keys.add(key);
    if (!Number.isFinite(row.value) || !Number.isSafeInteger(row.year)) throw new Error(`Invalid country metric: ${key}`);
  }
  if (!options.dryRun) for (const row of rows) {
    await db.insert(countryMetrics).values(row).onConflictDoUpdate({ target: [countryMetrics.jurisdictionId, countryMetrics.metricId, countryMetrics.year], set: { value: row.value, rank: row.rank, totalRanked: row.totalRanked, sourceId: row.sourceId, sourceUrl: row.sourceUrl, updatedAt: new Date() } });
  }
  if (options.stampFreshness !== false) {
    const counts = new Map<string, number>(); for (const row of rows) counts.set(row.sourceId, (counts.get(row.sourceId) ?? 0) + 1);
    for (const [sourceId, count] of counts) await (options.markSynced ?? markSourcesSynced)(sourceId, { rowsWritten: count, dryRun: options.dryRun });
  }
  return { proposed: rows.length, written: options.dryRun ? 0 : rows.length };
}
