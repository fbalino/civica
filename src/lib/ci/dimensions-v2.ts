/**
 * Civica Index — Beta methodology dimension config.
 *
 * Per the v2 methodology spec (~/Downloads/civica-index-methodology-v2.md),
 * the Beta governance core is FOUR dimensions, with Human Development and
 * Stability/Security moved out to the separate Civica Conditions layer.
 *
 * Weights are PROVISIONAL until the empirical factor analysis (Phase 5.3)
 * confirms the structure. Until then, the proportions in the spec §2.2 are
 * scaffolding — they sum to 1.00 and are clearly labelled as provisional
 * on every CI display.
 *
 * A 5th dimension (Administrative Capacity) is added back if and only if
 * factor analysis shows it's empirically distinct from Rule of Law.
 */

import type { CIDimensionKey } from "./dimensions";

/** Subset of CI dimensions used in the Beta governance core. */
export type CIDimensionV2 =
  | "democratic_quality"
  | "rule_of_law"
  | "freedom_rights"
  | "corruption_control";

export const V2_DIMENSIONS: readonly CIDimensionV2[] = [
  "democratic_quality",
  "rule_of_law",
  "freedom_rights",
  "corruption_control",
] as const;

/** Provisional weights — sum to 1.00. Spec §2.2. */
export const V2_WEIGHTS: Record<CIDimensionV2, number> = {
  democratic_quality: 0.30,
  rule_of_law: 0.25,
  freedom_rights: 0.25,
  corruption_control: 0.20,
};

/** Mandatory dimensions per spec §2.7 — if either is missing, no CI is
 * published for that country. */
export const V2_MANDATORY: readonly CIDimensionV2[] = [
  "democratic_quality",
  "rule_of_law",
] as const;

/** Optional dimensions — if one is missing, partial CI; if both are
 * missing AND mandatory dimensions are present, also partial. */
export const V2_OPTIONAL: readonly CIDimensionV2[] = [
  "freedom_rights",
  "corruption_control",
] as const;

/** Display labels for the Beta-era dimensions. */
export const V2_DIMENSION_LABELS: Record<CIDimensionV2, string> = {
  democratic_quality: "Democratic quality",
  rule_of_law: "Rule of law",
  freedom_rights: "Freedoms & rights",
  corruption_control: "Corruption control",
};

/** Type guard — useful when filtering existing 6-dim rows down to the
 * 4-dim governance core during the v2 calculation pass. */
export function isV2Dimension(d: string): d is CIDimensionV2 {
  return (V2_DIMENSIONS as readonly string[]).includes(d);
}

/** Re-export for callers that want the wider type. */
export type { CIDimensionKey };
