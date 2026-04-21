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

const TIERS: ReadonlyArray<{ min: number; info: TierInfo }> = [
  {
    min: 90,
    info: {
      key: "exceptional",
      label: "Exceptional",
      range: "90–100",
      className: "tier-90",
      bgClassName: "tier-90-bg",
      cssVar: "var(--tier-exceptional)",
      description: "Exceptional",
    },
  },
  {
    min: 75,
    info: {
      key: "strong",
      label: "Strong",
      range: "75–89",
      className: "tier-75",
      bgClassName: "tier-75-bg",
      cssVar: "var(--tier-strong)",
      description: "Strong governance",
    },
  },
  {
    min: 50,
    info: {
      key: "mixed",
      label: "Mixed",
      range: "50–74",
      className: "tier-50",
      bgClassName: "tier-50-bg",
      cssVar: "var(--tier-mixed)",
      description: "Mixed governance",
    },
  },
  {
    min: 25,
    info: {
      key: "weak",
      label: "Weak",
      range: "25–49",
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
      range: "0–24",
      className: "tier-0",
      bgClassName: "tier-0-bg",
      cssVar: "var(--tier-failed)",
      description: "Failed / authoritarian",
    },
  },
];

export function ciTier(score: number): TierInfo {
  for (const t of TIERS) {
    if (score >= t.min) return t.info;
  }
  return TIERS[TIERS.length - 1].info;
}

export const CI_TIER_LEGEND: ReadonlyArray<TierInfo> = [...TIERS]
  .reverse()
  .map((t) => t.info);
