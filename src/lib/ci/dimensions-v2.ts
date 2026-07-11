/**
 * Civica Index — Beta methodology dimension config.
 *
 * Per the v2 methodology spec (~/Downloads/civica-index-methodology-v2.md),
 * the Beta governance core is FOUR dimensions, with Human Development and
 * Stability/Security moved out to the separate Civica Conditions layer.
 *
 * Weights below preserve the historical Phase 5.3 recipe: squared PC1
 * loadings from a 46-country, four-input 2023 cross-section, rounded to
 * two decimals. This is a weight-derivation record, not validation of a
 * general or longitudinal "governance quality" factor.
 *
 *   democratic_quality  0.27   (PCA suggested 0.266)
 *   rule_of_law         0.26   (PCA suggested 0.257)
 *   freedom_rights      0.23   (PCA suggested 0.229)
 *   corruption_control  0.24   (PCA suggested 0.248)
 *
 * The proposed Administrative Capacity fifth dimension was not present
 * in this run. No distinctness or redundancy result exists for it.
 *
 * A later frozen 2000–2024 analysis found a strong common component in
 * cross-country levels and a much weaker one in annual changes. It did
 * not revise these deployed historical weights or test a fifth input.
 */

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

/** Historical Beta weights — sum to 1.00. PCA-informed by Phase 5.3
 * (squared PC1 loadings, rounded to 2dp). See the bounded record at
 * /civica-index/methodology/pca-appendix. */
export const V2_WEIGHTS: Record<CIDimensionV2, number> = {
  democratic_quality: 0.27,
  rule_of_law: 0.26,
  freedom_rights: 0.23,
  corruption_control: 0.24,
};

/** Mandatory dimensions per spec §2.7 — if either is missing, no CI is
 * published for that country. */
export const V2_MANDATORY: readonly CIDimensionV2[] = [
  "democratic_quality",
  "rule_of_law",
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
