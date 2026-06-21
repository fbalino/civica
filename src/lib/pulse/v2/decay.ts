/**
 * Phase 5.5 — exponential decay per spec §4.1.
 *
 * impact_today = severity × confidence × exp(-ln2 × days_since / half_life)
 *
 * The half-life is event-type-specific — coup d'état decays over 365
 * days, journalist-arrest events decay over 60 days, state collapse
 * over 730 days. See `taxonomy.ts` HALF_LIFE_DAYS lookup.
 */

import { halfLifeFor } from "./taxonomy";

const LN2 = Math.LN2;

/** Compute the decayed contribution of an event today. */
export function decayedImpact(
  severityValue: number,
  corroborationConfidence: number,
  daysSinceEvent: number,
  categoryId: string
): number {
  const halfLife = halfLifeFor(categoryId);
  const lambda = LN2 / halfLife;
  return severityValue * corroborationConfidence * Math.exp(-lambda * daysSinceEvent);
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Floor a Date to UTC midnight (epoch ms). */
function utcMidnight(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
}

/**
 * Days between the event date and today, floored at 0.
 *
 * Both sides are normalized to UTC date-only before differencing so the
 * day count is deterministic regardless of run time or server timezone.
 * A date-only `eventDate` ("YYYY-MM-DD") parses as UTC midnight; `today`
 * is likewise floored to UTC midnight, removing the previous off-by-one
 * drift at day boundaries.
 */
export function daysSince(eventDate: string, today = new Date()): number {
  const parsed = new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return 0;
  const d = utcMidnight(parsed);
  const t = utcMidnight(today);
  return Math.max(0, Math.floor((t - d) / MS_PER_DAY));
}
