/**
 * Phase 5.8 — backtest query helpers.
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  backtestCases,
  backtestRuns,
} from "@/lib/db/schema";

export interface BacktestSnapshotCase {
  id: string;
  countryName: string;
  countryIso3: string | null;
  eventDate: string;
  description: string;
  expected: Array<{
    dimension: string;
    direction: "positive" | "negative" | "mixed";
    magnitude: "moderate" | "severe" | "catastrophic";
  }>;
  /** Latest run row (or null when never run). */
  latest: {
    runId: string;
    ranAt: string;
    verdict: "pass" | "partial" | "fail";
    trajectory: Array<{
      dayOffset: number;
      dimension: string;
      delta: number;
    }>;
    detail: Array<{
      expected: {
        dimension: string;
        direction: string;
        magnitude: string;
      };
      peakDelta: number;
      peakDay: number;
      pass: boolean;
      notes: string;
    }>;
  } | null;
}

/** Returns every case with its most recent run (or null). Sorted by
 *  case id alphabetically. */
export async function getBacktestSnapshot(): Promise<BacktestSnapshotCase[]> {
  const cases = await db
    .select()
    .from(backtestCases)
    .orderBy(backtestCases.id);

  const out: BacktestSnapshotCase[] = [];

  for (const cs of cases) {
    const latestRows = await db
      .select()
      .from(backtestRuns)
      .where(eq(backtestRuns.caseId, cs.id))
      .orderBy(desc(backtestRuns.ranAt))
      .limit(1);
    const latest = latestRows[0];

    out.push({
      id: cs.id,
      countryName: cs.countryName,
      countryIso3: cs.countryIso3,
      eventDate: cs.eventDate,
      description: cs.description,
      expected: cs.expected as BacktestSnapshotCase["expected"],
      latest: latest
        ? {
            runId: latest.id,
            ranAt: latest.ranAt.toISOString(),
            verdict: latest.verdict as "pass" | "partial" | "fail",
            trajectory:
              latest.trajectory as BacktestSnapshotCase["latest"] extends infer T
                ? T extends null
                  ? never
                  : T extends { trajectory: infer U }
                    ? U
                    : never
                : never,
            detail:
              latest.detail as BacktestSnapshotCase["latest"] extends infer T
                ? T extends null
                  ? never
                  : T extends { detail: infer U }
                    ? U
                    : never
                : never,
          }
        : null,
    });
  }

  return out;
}

/** Returns aggregate stats for the report header. */
export async function getBacktestStats(): Promise<{
  totalCases: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  unrunCount: number;
  lastRunAt: string | null;
}> {
  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (case_id) case_id, verdict, ran_at
      FROM backtest_runs
      ORDER BY case_id, ran_at DESC
    )
    SELECT
      (SELECT COUNT(*)::int FROM backtest_cases) AS total_cases,
      (SELECT COUNT(*)::int FROM latest WHERE verdict = 'pass') AS pass_count,
      (SELECT COUNT(*)::int FROM latest WHERE verdict = 'partial') AS partial_count,
      (SELECT COUNT(*)::int FROM latest WHERE verdict = 'fail') AS fail_count,
      (SELECT MAX(ran_at) FROM backtest_runs) AS last_run_at
  `);
  const row = ((result as unknown as { rows?: unknown[] }).rows ??
    result) as Array<Record<string, unknown>>;
  const r = row[0] ?? {};
  const totalCases = Number(r.total_cases ?? 0);
  const passCount = Number(r.pass_count ?? 0);
  const partialCount = Number(r.partial_count ?? 0);
  const failCount = Number(r.fail_count ?? 0);
  const unrunCount = totalCases - passCount - partialCount - failCount;
  return {
    totalCases,
    passCount,
    partialCount,
    failCount,
    unrunCount,
    lastRunAt: r.last_run_at
      ? new Date(r.last_run_at as string).toISOString()
      : null,
  };
}
