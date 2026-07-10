/**
 * Phase 5.10 polish — human-readable labels for taxonomy ids.
 *
 * The DB stores `severe_neg`, `foreign_occupation`, `freedom_rights`
 * etc — perfect for SQL filters and JSON APIs, ugly in the admin UI.
 * This module is the single source of truth for converting any taxonomy
 * id to its display label.
 *
 * Categories pull straight from `EVENT_CATEGORIES.label` (the curated
 * label that already lives in the taxonomy file). Severity tiers and
 * dimensions are short fixed maps.
 */

import { EVENT_CATEGORIES } from "./taxonomy";

export const DIMENSION_LABELS: Record<string, string> = {
  democratic_quality: "Democratic Quality",
  rule_of_law: "Rule of Law",
  freedom_rights: "Rights & Freedoms",
  corruption_control: "Corruption Control",
  stability: "Stability",
  unresolved: "Unresolved",
};

export const SEVERITY_TIER_LABELS: Record<string, string> = {
  low_pos: "Low +",
  moderate_pos: "Moderate +",
  high_pos: "High +",
  low_neg: "Low −",
  moderate_neg: "Moderate −",
  severe_neg: "Severe −",
  catastrophic_neg: "Catastrophic −",
};

export const SEVERITY_TIER_LONG_LABELS: Record<string, string> = {
  low_pos: "Low + (1 to 2)",
  moderate_pos: "Moderate + (3 to 4)",
  high_pos: "High + (5 to 6)",
  low_neg: "Low − (-1 to -2)",
  moderate_neg: "Moderate − (-3 to -4)",
  severe_neg: "Severe − (-5 to -7)",
  catastrophic_neg: "Catastrophic − (-8 to -10)",
};

const _CATEGORY_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  EVENT_CATEGORIES.map((c) => [c.id, c.label])
);

/** Best-effort: returns the curated label if it exists, otherwise
 *  capitalises the snake-case id (e.g. `foreign_occupation` →
 *  `Foreign occupation`). */
export function categoryLabel(id: string): string {
  if (_CATEGORY_LABEL_BY_ID[id]) return _CATEGORY_LABEL_BY_ID[id];
  return id
    .split("_")
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function dimensionLabel(id: string): string {
  return DIMENSION_LABELS[id] ?? id;
}

export function severityTierLabel(id: string): string {
  return SEVERITY_TIER_LABELS[id] ?? id;
}

export function severityTierLongLabel(id: string): string {
  return SEVERITY_TIER_LONG_LABELS[id] ?? id;
}

/** Format a signed severity number as a string with explicit sign. */
export function signedSeverity(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}
