import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";

export const CURRENT_CI_RANK_POLICY = Object.freeze({
  schemaVersion: "ci-rank-policy/v1" as const,
  id: "ci-rank/competition-rounded-score-v1" as const,
  methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION,
  rankedQuantity: "published_integer_composite" as const,
  tieMethod: "competition" as const,
  tieBreaker: "none_for_published_rank" as const,
  displayOrderWithinTie: "jurisdiction_id_ascending_nonordinal" as const,
  rankUncertainty: "not_estimable_without_valid_score_uncertainty" as const,
  interpretation:
    "Rank orders rounded published estimates; countries with equal published scores share rank." as const,
});

export interface RankedPublishedScore<T> {
  row: T;
  rank: number;
  tieCount: number;
  occupiedPositionEnd: number;
}

export function competitionRankPublishedScores<T>(
  rows: readonly T[],
  scoreOf: (row: T) => number,
  stableIdOf: (row: T) => string,
): RankedPublishedScore<T>[] {
  const ordered = [...rows].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || stableIdOf(a).localeCompare(stableIdOf(b)),
  );
  const counts = new Map<number, number>();
  for (const row of ordered) counts.set(scoreOf(row), (counts.get(scoreOf(row)) ?? 0) + 1);
  let previousScore: number | undefined;
  let rank = 0;
  return ordered.map((row, index) => {
    const score = scoreOf(row);
    if (score !== previousScore) rank = index + 1;
    previousScore = score;
    const tieCount = counts.get(score) ?? 1;
    return { row, rank, tieCount, occupiedPositionEnd: rank + tieCount - 1 };
  });
}
