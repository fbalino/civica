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

/** Days between the event date and today, floored at 0. */
export function daysSince(eventDate: string, today = new Date()): number {
  const d = new Date(eventDate).getTime();
  if (Number.isNaN(d)) return 0;
  const t = today.getTime();
  return Math.max(0, Math.floor((t - d) / (1000 * 60 * 60 * 24)));
}
