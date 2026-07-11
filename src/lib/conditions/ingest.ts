import { civicaConditionsScores } from "@/lib/db/schema";
import { markSourcesSynced } from "@/lib/db/source-freshness";
import { indicatorLineageErrors, type IndicatorLineage } from "@/lib/indicators/lineage";

type Db = typeof import("@/lib/db").db;

export interface ConditionScoreInput extends IndicatorLineage {
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
    const key = `${row.jurisdictionId}:${row.dimension}:${row.quarter}:${row.methodologyVersion}:${row.sourceId}:${row.indicatorId}`;
    if (keys.has(key)) throw new Error(`Duplicate Conditions row: ${key}`);
    keys.add(key);
    const lineageErrors = indicatorLineageErrors(row);
    if (lineageErrors.length) throw new Error(`Invalid Conditions lineage for ${key}: ${lineageErrors.join(", ")}`);
    if (!Number.isFinite(row.normalizedScore) || row.normalizedScore < 0 || row.normalizedScore > 100) {
      throw new Error(`Invalid Conditions score for ${key}: ${row.normalizedScore}`);
    }
  }

  if (!options.dryRun) {
    for (const row of rows) {
      await db.insert(civicaConditionsScores).values(row).onConflictDoUpdate({
        target: [civicaConditionsScores.jurisdictionId, civicaConditionsScores.dimension, civicaConditionsScores.quarter, civicaConditionsScores.methodologyVersion, civicaConditionsScores.sourceId, civicaConditionsScores.indicatorId],
        set: { ...row },
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
