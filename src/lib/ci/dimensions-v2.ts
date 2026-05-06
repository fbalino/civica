/**
 * Civica Index — Beta methodology dimension config.
 *
 * Per the v2 methodology spec (~/Downloads/civica-index-methodology-v2.md),
 * the Beta governance core is FOUR dimensions, with Human Development and
 * Stability/Security moved out to the separate Civica Conditions layer.
 *
 * Weights below are derived from the Phase 5.3 PCA on 46 countries × 4
 * dimensions (full analysis at /civica-index/methodology/pca-appendix).
 * PC1 explains 90.7% of variance with all four dimensions loading
 * roughly equally — indicating one strong latent "governance quality"
 * factor. Final weights are the squared PC1 loadings, rounded to 2dp
 * and proven to sum to 1.00:
 *
 *   democratic_quality  0.27   (PCA suggested 0.266)
 *   rule_of_law         0.26   (PCA suggested 0.257)
 *   freedom_rights      0.23   (PCA suggested 0.229)
 *   corruption_control  0.24   (PCA suggested 0.248)
 *
 * The 5th-dimension test (Administrative Capacity from WGI Government
 * Effectiveness) is deferred — that indicator is not yet ingested.
 * When it is, re-run the analysis to test whether it loads on a
 * distinct factor or collapses into Rule of Law.
 *
 * NOTE: the Phase 5.3 panel is statistically usable (n=46) but
 * underpowered relative to the spec's 2000–2024 target. Weights will
 * be re-validated when the historical panel is ingested. The
 * structural decision (4-dim core, near-equal weights) is unlikely
 * to change.
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

/** Empirical weights — sum to 1.00. PCA-derived from Phase 5.3
 * (squared PC1 loadings, rounded to 2dp). See full analysis at
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
