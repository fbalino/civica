/**
 * Phase 5.5 — Pulse Beta event taxonomy.
 *
 * Hard-coded per Pulse Beta v0.9 spec §3.2 (categories per dimension),
 * §3.3 (severity → numeric mapping), and §4.1 (event-type-specific
 * decay half-lives). Keep this file as the single source of truth —
 * the classifier picks from `EVENT_CATEGORIES`, the corroboration step
 * reads `SEVERITY_TIER_RANGES`, and the scoring step reads `HALF_LIFE_DAYS`.
 *
 * ─────────────────────────────────────────────────────────────────
 *  TAXONOMY DECISION — coups map to STABILITY, not democratic_quality
 * ─────────────────────────────────────────────────────────────────
 *
 * The `coup` and `state_collapse` categories live on the `stability`
 * dimension. This is deliberate, not an oversight. Reviewers occasionally
 * raise the question "shouldn't a coup drive democratic_quality?" — the
 * answer is yes, but indirectly, through the cascade.
 *
 * Civica Pulse models a coup as the *stability rupture*. The
 * democratic_quality damage that follows is captured through the
 * cascade of post-coup events that are independently classifiable:
 *
 *   - Parliament dissolution    → constitutional_override_electoral
 *                                  → democratic_quality
 *   - Election results annulled → mass_disenfranchisement
 *                                  → democratic_quality
 *   - Term extensions / "transition plans"
 *                                → term_extension
 *                                  → democratic_quality
 *   - Show trials of opposition → judicial_independence_rollback
 *                                  → rule_of_law
 *   - Martial law / military tribunals
 *                                → martial_law
 *                                  → rule_of_law
 *   - Press shutdowns           → media_shutdown / journalist_arrest
 *                                  → freedom_rights
 *
 * This mirrors how political scientists model regime breakdown: the
 * coup is the rupture event, the consolidation kills democratic
 * institutions over the following weeks and months. Each cascade
 * event is its own classifiable record; their dimensional impacts
 * accumulate naturally on the right rows.
 *
 * Implication for ground-truth seed data (backtesting): a single
 * "coup" headline is not enough to reach catastrophic-magnitude
 * deltas on democratic_quality or rule_of_law. The cascade events
 * must be present too. See `data/backtest/myanmar-2021.json` for
 * the canonical example.
 */

import type { PulseDimension, SeverityTier } from "./types";

export type EventDirection = "positive" | "negative" | "mixed";

export interface EventCategory {
  /** Stable internal id used by classifier output and DB rows */
  id: string;
  /** Human-readable label for UI + classifier prompt */
  label: string;
  dimension: PulseDimension;
  direction: EventDirection;
  /** Allowed severity tiers — classifier must pick one of these */
  allowedTiers: SeverityTier[];
  /** Decay half-life in days per spec §4.1 */
  halfLifeDays: number;
}

/** Severity tier numeric ranges per spec §3.3. Inclusive both ends. */
export const SEVERITY_TIER_RANGES: Record<
  SeverityTier,
  { min: number; max: number }
> = {
  low_pos: { min: 1, max: 2 },
  moderate_pos: { min: 3, max: 4 },
  high_pos: { min: 5, max: 6 },
  low_neg: { min: -2, max: -1 },
  moderate_neg: { min: -4, max: -3 },
  severe_neg: { min: -7, max: -5 },
  catastrophic_neg: { min: -10, max: -8 },
};

/** Returns true if the severity tier represents a positive event.
 *  Used by the asymmetric-scoring rule in `corroborate.ts` (spec §3.4). */
export function isPositiveTier(tier: SeverityTier): boolean {
  return tier === "low_pos" || tier === "moderate_pos" || tier === "high_pos";
}

/** Tiers that require human review before scoring, per spec §5.1. */
export const HUMAN_REVIEW_TIERS = new Set<SeverityTier>([
  "severe_neg",
  "catastrophic_neg",
  "high_pos",
]);

/**
 * Event taxonomy — categories the classifier can pick from.
 *
 * Each entry maps to (a) a CI dimension, (b) a direction, (c) the
 * severity tiers permitted for the category, and (d) a decay half-life.
 * The taxonomy below covers spec §3.2's full list; if you add a new
 * category here, it becomes available in the classifier prompt
 * automatically.
 */
export const EVENT_CATEGORIES: EventCategory[] = [
  // --- Democratic Quality ---
  {
    id: "fair_election",
    label: "Free and fair election",
    dimension: "democratic_quality",
    direction: "positive",
    allowedTiers: ["low_pos", "moderate_pos", "high_pos"],
    halfLifeDays: 90,
  },
  {
    id: "flawed_election",
    label: "Flawed but contested election",
    dimension: "democratic_quality",
    direction: "mixed",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "election_cancellation",
    label: "Election cancellation or postponement",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "constitutional_override_electoral",
    label: "Constitutional override of electoral result",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "mass_disenfranchisement",
    label: "Mass disenfranchisement",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "peaceful_transfer",
    label: "Successful peaceful transfer of power",
    dimension: "democratic_quality",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 90,
  },
  {
    id: "term_extension",
    label: "Constitutional term extension (self-coup)",
    dimension: "democratic_quality",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },

  // --- Rule of Law ---
  {
    id: "judicial_purge",
    label: "Judicial purge (mass dismissal of judges)",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },
  {
    id: "executive_constitutional_override",
    label: "Constitutional override by executive",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "anticorruption_conviction",
    label: "Independent anti-corruption conviction (high-profile)",
    dimension: "rule_of_law",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 120,
  },
  {
    id: "judicial_independence_expansion",
    label: "Judicial independence reform (expansion)",
    dimension: "rule_of_law",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "judicial_independence_rollback",
    label: "Judicial independence rollback (curtailment)",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 365,
  },
  {
    id: "martial_law",
    label: "Martial law declaration",
    dimension: "rule_of_law",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 365,
  },

  // --- Rights & Freedoms ---
  {
    id: "journalist_arrest",
    label: "Journalist arrested or killed",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["low_neg", "moderate_neg", "severe_neg"],
    halfLifeDays: 60,
  },
  {
    id: "media_shutdown",
    label: "Media outlet shutdown",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "protest_crackdown",
    label: "Protest crackdown with casualties",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg", "catastrophic_neg"],
    halfLifeDays: 90,
  },
  {
    id: "systematic_crackdown",
    label: "Systematic crackdown (pattern of abuse)",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    halfLifeDays: 180,
  },
  {
    id: "mass_detention",
    label: "Mass political detention",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 180,
  },
  {
    id: "press_freedom_expansion",
    label: "Press freedom law expansion",
    dimension: "freedom_rights",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "assembly_rights_expansion",
    label: "Assembly / association rights expansion",
    dimension: "freedom_rights",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "internet_shutdown",
    label: "Internet shutdown",
    dimension: "freedom_rights",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 60,
  },

  // --- Corruption Control ---
  {
    id: "corruption_conviction",
    label: "High-level corruption conviction",
    dimension: "corruption_control",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 120,
  },
  {
    id: "corruption_scandal",
    label: "Major corruption scandal (documented)",
    dimension: "corruption_control",
    direction: "negative",
    allowedTiers: ["moderate_neg", "severe_neg"],
    halfLifeDays: 120,
  },
  {
    id: "anticorruption_law",
    label: "Anti-corruption law enactment",
    dimension: "corruption_control",
    direction: "positive",
    allowedTiers: ["low_pos", "moderate_pos"],
    halfLifeDays: 180,
  },
  {
    id: "anticorruption_dismantling",
    label: "Anti-corruption institution dismantling",
    dimension: "corruption_control",
    direction: "negative",
    allowedTiers: ["severe_neg"],
    halfLifeDays: 365,
  },

  // --- Stability (spillover) ---
  {
    id: "armed_conflict",
    label: "Armed conflict outbreak",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["severe_neg", "catastrophic_neg"],
    // Spec §4.1: does not decay while active; 180 days from cessation.
    // For pipeline simplicity, we use 180 days unconditionally; the human
    // reviewer can re-classify with a fresh event when the conflict ends.
    halfLifeDays: 180,
  },
  {
    id: "peace_agreement_signed",
    label: "Peace agreement signed (announcement)",
    dimension: "stability",
    direction: "positive",
    allowedTiers: ["moderate_pos"],
    halfLifeDays: 90,
  },
  {
    id: "peace_agreement_implemented",
    label: "Peace agreement implementation evidence",
    dimension: "stability",
    direction: "positive",
    allowedTiers: ["moderate_pos", "high_pos"],
    halfLifeDays: 365,
  },
  {
    id: "coup",
    label: "Coup d'état",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["catastrophic_neg"],
    halfLifeDays: 365,
  },
  {
    id: "state_collapse",
    label: "State collapse",
    dimension: "stability",
    direction: "negative",
    allowedTiers: ["catastrophic_neg"],
    halfLifeDays: 730,
  },
];

/** Quick lookup by category id. */
export const EVENT_CATEGORY_INDEX: Record<string, EventCategory> =
  Object.fromEntries(EVENT_CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): EventCategory | null {
  return EVENT_CATEGORY_INDEX[id] ?? null;
}

/** Half-life lookup. Falls back to 90 days for unknown categories. */
export function halfLifeFor(categoryId: string): number {
  return EVENT_CATEGORY_INDEX[categoryId]?.halfLifeDays ?? 90;
}

/** Per spec §4.3, dimensional deltas are clamped to this range. */
export const DELTA_LOWER_BOUND = -15;
export const DELTA_UPPER_BOUND = 10;

/** Per spec §4.2, scoring window. */
export const SCORE_WINDOW_DAYS = 365;
