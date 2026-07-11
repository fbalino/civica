import { averageRankPercentiles } from "./sensitivity-analysis";
import { median, quantile } from "./longitudinal-analysis";

export type FairnessProfile = {
  iso3: string;
  score: number | null;
  sourceCount: number;
  uncertaintyCount: number;
  groups: Record<string, string>;
  scarcityDelta: number | null;
};

export function terciles(rows: readonly { iso3: string; value: number }[], higherLabel = "high") {
  const ranks = averageRankPercentiles(rows);
  return new Map(rows.map((row) => {
    const percentile = ranks.get(row.iso3)!;
    const label = percentile < 100 / 3 ? "low" : percentile < 200 / 3 ? "middle" : higherLabel;
    return [row.iso3, label];
  }));
}

export function summarizeSubgroups(profiles: readonly FairnessProfile[], family: string) {
  const labels = [...new Set(profiles.map((row) => row.groups[family] ?? "missing"))].sort();
  return labels.map((group) => {
    const rows = profiles.filter((row) => (row.groups[family] ?? "missing") === group);
    const published = rows.filter((row) => row.score !== null);
    const deltas = rows.flatMap((row) => row.scarcityDelta === null ? [] : [row.scarcityDelta]);
    return {
      group,
      eligible: rows.length,
      published: published.length,
      publicationRate: rows.length ? published.length / rows.length : null,
      scoreMedian: published.length ? median(published.map((row) => row.score!)) : null,
      scoreP10: published.length ? quantile(published.map((row) => row.score!), 0.1) : null,
      scoreP90: published.length ? quantile(published.map((row) => row.score!), 0.9) : null,
      meanBoundedDimensions: rows.reduce((sum, row) => sum + row.uncertaintyCount, 0) / rows.length,
      scarcityTestN: deltas.length,
      scarcityMedianDelta: deltas.length ? median(deltas) : null,
      scarcityNegativeShare: deltas.length ? deltas.filter((value) => value < 0).length / deltas.length : null,
      performanceStatus: rows.length >= 30 ? "descriptive_only_no_external_truth" : "suppressed_below_n30",
    };
  });
}
