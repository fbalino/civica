import { computeOne, type DimensionRow } from "./calculate-v2";
import { V2_WEIGHTS } from "./dimensions-v2";
import { CURRENT_CI_MISSINGNESS_POLICY } from "./missingness-policy";
import { competitionRankPublishedScores, CURRENT_CI_RANK_POLICY } from "./rank-policy";
import { CURRENT_CI_UNCERTAINTY_POLICY } from "./uncertainty-policy";
import { jointTournamentSplit } from "./tournament-baselines";

export const K1_TOURNAMENT_METHOD_VERSION = "k1-current-composite-tournament/v1";
export const K1_INPUT_IDENTITIES = ["vdem:v2x_libdem", "worldbank_wgi:va.est", "worldbank_wgi:rl.est", "freedom_house:pr_cl_total", "transparency_intl:score"] as const;
export const K1_INPUT_IDENTITY_ALIASES = Object.freeze({
  "freedom_house:fh_pr_cl_sum": "freedom_house:pr_cl_total",
  "transparency_intl:CPI_SCORE": "transparency_intl:score",
} as const);

export interface K1PanelInput {
  jurisdictionId: string;
  iso3: string;
  periodYear: number;
  dimension: string;
  sourceId: string;
  indicatorId: string;
  value: number | null;
}

export interface K1TournamentOutput {
  candidateId: "K1";
  unitId: string;
  jurisdictionId: string;
  iso3: string;
  periodYear: number;
  split: "development" | "validation" | "final_holdout";
  scoreInteger: number;
  scoreLower: null;
  scoreUpper: null;
  uncertaintyStatus: "not_estimable_without_retained_source_uncertainty_and_dependence";
  completeness: "full" | "partial";
  dimensionsAvailable: number;
  missingDimensions: readonly string[];
  inputIdentities: readonly string[];
  rank: number;
  tieCount: number;
  rankUncertainty: "not_estimable_without_valid_score_uncertainty";
  methodVersion: typeof K1_TOURNAMENT_METHOD_VERSION;
}

export const K1_TOURNAMENT_CONTRACT = Object.freeze({
  candidateId: "K1" as const,
  methodVersion: K1_TOURNAMENT_METHOD_VERSION,
  inputIdentities: K1_INPUT_IDENTITIES,
  inputIdentityAliases: K1_INPUT_IDENTITY_ALIASES,
  democraticQualityPrecedence: ["vdem:v2x_libdem", "worldbank_wgi:va.est"] as const,
  weights: V2_WEIGHTS,
  missingnessPolicy: CURRENT_CI_MISSINGNESS_POLICY.id,
  uncertaintyPolicy: CURRENT_CI_UNCERTAINTY_POLICY.id,
  uncertaintyDependence: "no interval because source-specific uncertainty and covariance are not retained" as const,
  rankPolicy: CURRENT_CI_RANK_POLICY.id,
  publishedQuantity: "rounded deterministic weighted composite" as const,
});

function groupInputs(rows: readonly K1PanelInput[]): Map<string, K1PanelInput[]> {
  const groups = new Map<string, K1PanelInput[]>();
  for (const row of rows) {
    const key = `${row.iso3}:${row.periodYear}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

export function selectK1DimensionRows(rows: readonly K1PanelInput[]): { dimensions: DimensionRow[]; inputIdentities: string[] } {
  const observed = new Map<string, K1PanelInput>(rows.filter((row) => row.value !== null).map((row) => {
    const actual = `${row.sourceId}:${row.indicatorId}`;
    const canonical = K1_INPUT_IDENTITY_ALIASES[actual as keyof typeof K1_INPUT_IDENTITY_ALIASES] ?? actual;
    return [canonical, row];
  }));
  const democratic = observed.get("vdem:v2x_libdem") ?? observed.get("worldbank_wgi:va.est");
  const selected = [democratic, observed.get("worldbank_wgi:rl.est"), observed.get("freedom_house:pr_cl_total"), observed.get("transparency_intl:score")].filter((row): row is K1PanelInput => Boolean(row));
  return {
    dimensions: selected.map((row) => ({ jurisdictionId: row.jurisdictionId, dimension: row.dimension, rawValue: row.value, sourceId: row.sourceId })),
    inputIdentities: selected.map((row) => `${row.sourceId}:${row.indicatorId}`),
  };
}

export function runK1TournamentCandidate(rows: readonly K1PanelInput[]): K1TournamentOutput[] {
  const unranked = [...groupInputs(rows).entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, group]) => {
    const selected = selectK1DimensionRows(group);
    const result = computeOne(selected.dimensions);
    if (!result || result.completeness === "insufficient") return [];
    const first = group[0];
    return [{
      candidateId: "K1" as const, unitId: `${first.iso3}:${first.periodYear}`, jurisdictionId: first.jurisdictionId,
      iso3: first.iso3, periodYear: first.periodYear, split: jointTournamentSplit(first.iso3, first.periodYear),
      scoreInteger: result.scoreInteger, scoreLower: null, scoreUpper: null,
      uncertaintyStatus: "not_estimable_without_retained_source_uncertainty_and_dependence" as const,
      completeness: result.completeness, dimensionsAvailable: result.dimensionsAvailable,
      missingDimensions: result.missingDimensions, inputIdentities: selected.inputIdentities,
    }];
  });
  const byYear = new Map<number, typeof unranked>();
  for (const row of unranked) byYear.set(row.periodYear, [...(byYear.get(row.periodYear) ?? []), row]);
  return [...byYear.entries()].sort(([a], [b]) => a - b).flatMap(([, yearRows]) => competitionRankPublishedScores(yearRows, (row) => row.scoreInteger, (row) => row.jurisdictionId).map(({ row, rank, tieCount }) => ({
    ...row, rank, tieCount, rankUncertainty: "not_estimable_without_valid_score_uncertainty" as const,
    methodVersion: K1_TOURNAMENT_METHOD_VERSION,
  })));
}
