/**
 * Phase 5.6 — CI/Pulse double-counting prevention.
 *
 * When a quarterly CI recompute lands, V-Dem and WGI data refreshes
 * absorb events that were previously only visible in the Pulse layer.
 * Without intervention, those events would be counted twice — once
 * by the Pulse, once by the new structural CI score.
 *
 * This helper compares the just-computed CI v2 dimensional scores
 * against the previous quarter's. For each (country, dimension) where
 * the score moved by ≥ threshold points, walks all published
 * pulse_events_v2 rows for that (country, dimension) whose event_date
 * pre-dates the new quarter's calculation, and zeros their
 * `corroboration_confidence`. The downstream score recomputation then
 * naturally drops them. The audit trail in `review_notes` records the
 * reason.
 *
 * Conservative by design: we keep the event row, just zero its
 * contribution. If a dispute later surfaces that a particular event
 * was wrongly absorbed, the original severity + classifier audit
 * remain intact.
 */

import { and, eq, lt, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  ciDimensionScores,
  pulseEventsV2,
} from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

/** CI v2 dimensions whose names line up with Pulse dimensions. The
 *  Pulse-only `stability` dimension is intentionally NOT in this list
 *  because no CI v2 dimension absorbs it. */
const SHARED_DIMENSIONS = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
] as const;

/** Default trigger: a CI dimension move of ≥ 3 points means the
 *  upstream data has materially shifted, so events feeding the same
 *  dimension before this recompute are likely already absorbed. */
export const DEFAULT_DECOUPLE_THRESHOLD = 3;

export interface DecoupleSummary {
  /** True when the helper was a no-op because there's no previous
   *  quarter to compare against (first beta-quarter run). */
  noPreviousQuarter: boolean;
  /** (country, dim) pairs that crossed the threshold. */
  pairsCrossed: number;
  /** pulse_events_v2 rows whose corroboration_confidence got zeroed. */
  eventsZeroed: number;
  /** Per-dimension breakdown for log output. */
  byDimension: Record<string, number>;
}

interface DimensionScorePair {
  jurisdictionId: string;
  dimension: string;
  current: number;
  previous: number;
  delta: number;
}

/**
 * Run the decouple pass. Pass `dryRun=true` to compute everything but
 * skip the UPDATE.
 */
export async function decoupleAbsorbedEvents(
  db: Db,
  newQuarter: string,
  opts: {
    methodologyVersion?: string;
    threshold?: number;
    dryRun?: boolean;
  } = {}
): Promise<DecoupleSummary> {
  const methodologyVersion = opts.methodologyVersion ?? "beta";
  const threshold = opts.threshold ?? DEFAULT_DECOUPLE_THRESHOLD;
  const dryRun = opts.dryRun ?? false;

  const previousQuarter = await findPreviousQuarter(
    db,
    newQuarter,
    methodologyVersion
  );

  if (!previousQuarter) {
    return {
      noPreviousQuarter: true,
      pairsCrossed: 0,
      eventsZeroed: 0,
      byDimension: {},
    };
  }

  // Pull both quarters' dimensional scores in one go for the shared
  // dimensions, then JOIN per-country.
  const result = await db.execute(sql`
    SELECT
      cur.jurisdiction_id,
      cur.dimension,
      cur.normalized_score AS current_score,
      prev.normalized_score AS previous_score
    FROM ci_dimension_scores cur
    JOIN ci_dimension_scores prev
      ON prev.jurisdiction_id = cur.jurisdiction_id
      AND prev.dimension = cur.dimension
      AND prev.methodology_version = cur.methodology_version
      AND prev.quarter = ${previousQuarter}
    WHERE cur.quarter = ${newQuarter}
      AND cur.methodology_version = ${methodologyVersion}
      AND cur.dimension IN ${SHARED_DIMENSIONS}
  `);

  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;

  const pairs: DimensionScorePair[] = (rows as Array<Record<string, unknown>>)
    .map((r) => {
      const current = Number(r.current_score);
      const previous = Number(r.previous_score);
      return {
        jurisdictionId: String(r.jurisdiction_id),
        dimension: String(r.dimension),
        current,
        previous,
        delta: current - previous,
      };
    })
    .filter((p) => Math.abs(p.delta) >= threshold);

  const byDimension: Record<string, number> = {};
  let eventsZeroed = 0;

  // Cutoff for the absorbed-event window. A CI vintage is labelled
  // `${dataYear}-Q4` (see ci/normalize.ts `yearToQuarter`) but absorbs
  // the FULL calendar data year, not just Q4. So we zero every Pulse
  // event dated within that data year (and earlier), using an exclusive
  // cutoff of the first day of the FOLLOWING year — not the quarter
  // start, which would leave Jan–Sep in-year events to be double-counted.
  const cutoffDate = absorbedYearCutoffDate(newQuarter);

  for (const pair of pairs) {
    byDimension[pair.dimension] = (byDimension[pair.dimension] ?? 0) + 1;

    // Find the affected events
    const affected = await db
      .select({ id: pulseEventsV2.id })
      .from(pulseEventsV2)
      .where(
        and(
          eq(pulseEventsV2.jurisdictionId, pair.jurisdictionId),
          eq(pulseEventsV2.dimension, pair.dimension),
          eq(pulseEventsV2.published, true),
          lt(pulseEventsV2.eventDate, cutoffDate),
          sql`${pulseEventsV2.corroborationConfidence} > 0`
        )
      );

    if (!dryRun && affected.length > 0) {
      const note = `Absorbed by CI v2 ${newQuarter} recompute (dim moved ${pair.delta.toFixed(2)})`;
      await db
        .update(pulseEventsV2)
        .set({
          corroborationConfidence: 0,
          reviewNotes: sql`COALESCE(${pulseEventsV2.reviewNotes} || E'\\n', '') || ${note}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(pulseEventsV2.jurisdictionId, pair.jurisdictionId),
            eq(pulseEventsV2.dimension, pair.dimension),
            eq(pulseEventsV2.published, true),
            lt(pulseEventsV2.eventDate, cutoffDate),
            sql`${pulseEventsV2.corroborationConfidence} > 0`
          )
        );
    }

    eventsZeroed += affected.length;
  }

  return {
    noPreviousQuarter: false,
    pairsCrossed: pairs.length,
    eventsZeroed,
    byDimension,
  };
}

/** Find the most-recent quarter strictly before `newQuarter` that has
 *  rows under the given methodologyVersion in ci_dimension_scores. */
async function findPreviousQuarter(
  db: Db,
  newQuarter: string,
  methodologyVersion: string
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT DISTINCT quarter
    FROM ci_dimension_scores
    WHERE methodology_version = ${methodologyVersion}
      AND quarter < ${newQuarter}
    ORDER BY quarter DESC
    LIMIT 1
  `);
  const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? String(row.quarter) : null;
}

/**
 * Exclusive cutoff for the data year a CI vintage absorbs.
 *
 * CI vintages are labelled `${dataYear}-Q4` but each represents a full
 * calendar data year (see ci/normalize.ts `yearToQuarter`). To zero
 * every Pulse event the new CI release already absorbed, the exclusive
 * cutoff (used with `event_date < cutoff`) is the first day of the year
 * AFTER the data year, so the entire absorbed year — Jan through Dec —
 * is covered. Falls back conservatively to the year after the parsed
 * year for any non-standard quarter label.
 */
function absorbedYearCutoffDate(quarter: string): string {
  const match = quarter.match(/^(\d{4})-Q[1-4]$/);
  const dataYear = match ? parseInt(match[1], 10) : NaN;
  if (Number.isNaN(dataYear)) {
    // Unparseable label — fall back to the leading 4-digit year if any,
    // else a far-future cutoff so we err toward zeroing more (the
    // conservative double-count-prevention choice).
    const yearMatch = quarter.match(/^(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 9999;
    return `${year + 1}-01-01`;
  }
  return `${dataYear + 1}-01-01`;
}
