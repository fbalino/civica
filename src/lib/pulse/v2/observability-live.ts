import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { SCORE_WINDOW_DAYS } from "./taxonomy";
import {
  buildPulseCountryPeriodObservability,
  type PulseCountryPeriodObservability,
  type PulseCountryPeriodSourceCount,
} from "./observability";
import { loadPulseSourceCoverageReport } from "./source-coverage";

function resultRows(result: unknown): Array<Record<string, unknown>> {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? [])
  ) as Array<Record<string, unknown>>;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function loadPulseCountryPeriodObservability(input: {
  jurisdictionId: string;
  qualifyingEvents: number;
  now?: Date;
}): Promise<PulseCountryPeriodObservability> {
  const now = input.now ?? new Date();
  const periodEnd = isoDate(now);
  const periodStart = isoDate(
    new Date(now.getTime() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000),
  );
  const db = getDb();
  const [coverage, countResult] = await Promise.all([
    loadPulseSourceCoverageReport(),
    db.execute(sql`
      SELECT source_id, COUNT(*)::int AS retained_documents
      FROM raw_events
      WHERE jurisdiction_id = ${input.jurisdictionId}::uuid
        AND retrieved_at >= ${periodStart}::date
        AND retrieved_at < (${periodEnd}::date + INTERVAL '1 day')
      GROUP BY source_id
      ORDER BY source_id
    `),
  ]);
  const sourceCounts: PulseCountryPeriodSourceCount[] = resultRows(
    countResult,
  ).map((row) => ({
    sourceId: String(row.source_id),
    retainedDocuments: Number(row.retained_documents),
  }));

  return buildPulseCountryPeriodObservability({
    periodStart,
    periodEnd,
    feeds: coverage.feeds,
    sourceCounts,
    qualifyingEvents: input.qualifyingEvents,
    // Production context stays absent until a complete, versioned source is
    // both rights-cleared and validated for this use.
    informationEnvironment: null,
  });
}
