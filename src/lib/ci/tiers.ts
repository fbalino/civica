/**
 * DEPRECATED HISTORICAL REPLAY ONLY (retired 2026-07-09).
 *
 * Public country surfaces no longer map numeric estimates to qualitative
 * tiers or traffic-light colors. Keep this module only to explain and replay
 * archived presentation; current code must use neutral numeric position.
 */

export type TierKey = "exceptional" | "strong" | "mixed" | "weak" | "failed";

export interface TierInfo {
  key: TierKey;
  label: string;
  range: string;
  className: string;
  bgClassName: string;
  cssVar: string;
  description: string;
}

// Exact cutoffs and labels are preserved solely so archived screenshots and
// stored legacy values remain interpretable. Do not reuse this mapping.
const TIERS: ReadonlyArray<{ min: number; info: TierInfo }> = [
  {
    min: 85,
    info: {
      key: "exceptional",
      label: "Exceptional",
      range: "85-100",
      className: "tier-90",
      bgClassName: "tier-90-bg",
      cssVar: "var(--tier-exceptional)",
      description: "Exceptional governance",
    },
  },
  {
    min: 70,
    info: {
      key: "strong",
      label: "Strong",
      range: "70-84",
      className: "tier-75",
      bgClassName: "tier-75-bg",
      cssVar: "var(--tier-strong)",
      description: "Strong governance",
    },
  },
  {
    min: 55,
    info: {
      key: "mixed",
      label: "Mixed",
      range: "55-69",
      className: "tier-50",
      bgClassName: "tier-50-bg",
      cssVar: "var(--tier-mixed)",
      description: "Mixed governance",
    },
  },
  {
    min: 40,
    info: {
      key: "weak",
      label: "Weak",
      range: "40-54",
      className: "tier-25",
      bgClassName: "tier-25-bg",
      cssVar: "var(--tier-weak)",
      description: "Weak governance",
    },
  },
  {
    min: 0,
    info: {
      key: "failed",
      label: "Failed",
      range: "0-39",
      className: "tier-0",
      bgClassName: "tier-0-bg",
      cssVar: "var(--tier-failed)",
      description: "Failed governance",
    },
  },
];

/** @deprecated Historical audit/replay only. */
export function ciTier(score: number): TierInfo {
  for (const tier of TIERS) {
    if (score >= tier.min) return tier.info;
  }

  return TIERS[TIERS.length - 1].info;
}

/** @deprecated Historical audit/replay only. */
export const CI_TIER_LEGEND: ReadonlyArray<TierInfo> = [...TIERS]
  .reverse()
  .map((tier) => tier.info);
