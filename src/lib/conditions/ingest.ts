import { civicaConditionsScores } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";

type Db = typeof import("@/lib/db").db;

export interface ConditionScoreInput {
  jurisdictionId: string;
  dimension: string;
  quarter: string;
  normalizedScore: number;
  rawValue: number | null;
  sourceId: string;
  datasetYear: number;
  methodologyVersion: string;
}

export async function writeConditionScores(
  db: Db,
  rows: ConditionScoreInput[],
  options: { dryRun?: boolean; markSynced?: typeof markSourcesSynced } = {},
): Promise<{ proposed: number; written: number }> {
  if (rows.length === 0) throw new Error("Conditions input produced zero rows");
  const keys = new Set<string>();
  for (const row of rows) {
    const key = `${row.jurisdictionId}:${row.dimension}:${row.quarter}:${row.methodologyVersion}`;
    if (keys.has(key)) throw new Error(`Duplicate Conditions row: ${key}`);
    keys.add(key);
    if (!Number.isFinite(row.normalizedScore) || row.normalizedScore < 0 || row.normalizedScore > 100) {
      throw new Error(`Invalid Conditions score for ${key}: ${row.normalizedScore}`);
    }
  }

  if (!options.dryRun) {
    for (const row of rows) {
      await db.insert(civicaConditionsScores).values(row).onConflictDoUpdate({
        target: [civicaConditionsScores.jurisdictionId, civicaConditionsScores.dimension, civicaConditionsScores.quarter, civicaConditionsScores.methodologyVersion],
        set: { normalizedScore: row.normalizedScore, rawValue: row.rawValue, datasetYear: row.datasetYear, sourceId: row.sourceId },
      });
    }
  }

  const bySource = new Map<string, number>();
  for (const row of rows) bySource.set(row.sourceId, (bySource.get(row.sourceId) ?? 0) + 1);
  for (const [sourceId, count] of bySource) {
    await (options.markSynced ?? markSourcesSynced)(sourceId, { rowsWritten: count, dryRun: options.dryRun });
  }
  return { proposed: rows.length, written: options.dryRun ? 0 : rows.length };
}
