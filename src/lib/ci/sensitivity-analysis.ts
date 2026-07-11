import { researchPanelHash } from "./research-panel";
import { spearman } from "./validity-analysis";
import { median, quantile } from "./longitudinal-analysis";
export interface SensitivityScore {
  iso3: string;
  score: number;
}
export function rankScores(rows: readonly SensitivityScore[]) {
  const sorted = [...rows].sort(
      (a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3),
    ),
    out = new Map<string, number>();
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].score === sorted[start].score)
      end++;
    const rank = start + 1;
    for (let i = start; i < end; i++) out.set(sorted[i].iso3, rank);
    start = end;
  }
  return out;
}
export function compareSensitivity(
  base: readonly SensitivityScore[],
  variant: readonly SensitivityScore[],
) {
  const bRank = rankScores(base),
    vRank = rankScores(variant),
    vScore = new Map(variant.map((r) => [r.iso3, r.score])),
    common = base.filter((r) => vScore.has(r.iso3));
  const shifts = common.map((r) =>
    Math.abs(bRank.get(r.iso3)! - vRank.get(r.iso3)!),
  );
  const topN = Math.max(1, Math.ceil(common.length * 0.1)),
    bTop = new Set(
      [...common]
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((r) => r.iso3),
    ),
    vTop = new Set(
      [...variant]
        .filter((r) => bRank.has(r.iso3))
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map((r) => r.iso3),
    ),
    intersection = [...bTop].filter((x) => vTop.has(x)).length;
  return {
    common: common.length,
    coverage: variant.length,
    scoreSpearman: spearman(
      common.map((r) => ({ x: r.score, y: vScore.get(r.iso3)! })),
    ),
    rankSpearman: spearman(
      common.map((r) => ({ x: bRank.get(r.iso3)!, y: vRank.get(r.iso3)! })),
    ),
    medianAbsoluteRankShift: median(shifts),
    p95AbsoluteRankShift: quantile(shifts, 0.95),
    maxAbsoluteRankShift: Math.max(...shifts),
    topDecileJaccard: intersection / new Set([...bTop, ...vTop]).size,
    comparisonSha256: researchPanelHash({
      common: common.map((r) => r.iso3),
      shifts,
    }),
  };
}
export function averageRankPercentiles(
  values: readonly { iso3: string; value: number }[],
) {
  const sorted = [...values].sort(
      (a, b) => a.value - b.value || a.iso3.localeCompare(b.iso3),
    ),
    out = new Map<string, number>();
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value)
      end++;
    const rank = (start + 1 + end) / 2,
      p = sorted.length === 1 ? 50 : ((rank - 1) / (sorted.length - 1)) * 100;
    for (let i = start; i < end; i++) out.set(sorted[i].iso3, p);
    start = end;
  }
  return out;
}
