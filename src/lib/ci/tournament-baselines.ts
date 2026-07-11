import { CI_RESEARCH_PANEL_INDICATORS, researchPanelHash } from "./research-panel";
import { geographicTournamentBucket, INDEX_TOURNAMENT_PREREGISTRATION } from "./tournament-preregistration";

export const INDEX_BASELINE_IMPLEMENTATION_VERSION = "civica-index-baselines/v2";
export const GOVERNANCE_BASELINE_SOURCES = ["vdem", "worldbank_wgi", "freedom_house", "transparency_intl"] as const;

export interface BaselinePanelObservation {
  jurisdictionId: string;
  iso3: string;
  periodYear: number;
  sourceId: string;
  indicatorId: string;
  value: number | null;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
}

export interface BaselineOutput {
  baselineId: "B0" | "B1" | "B2" | "B3";
  unitId: string;
  iso3: string;
  periodYear: number;
  split: "development" | "validation" | "final_holdout";
  value: number | null;
  scale: string;
  inputSources: readonly string[];
  missingSources: readonly string[];
  methodVersion: typeof INDEX_BASELINE_IMPLEMENTATION_VERSION;
}

export interface FactorModel {
  sourceOrder: readonly string[];
  means: readonly number[];
  standardDeviations: readonly number[];
  loadings: readonly number[];
  iterations: number;
  tolerance: number;
  fitRows: number;
}

function temporalSplit(year: number): BaselineOutput["split"] {
  if (year <= INDEX_TOURNAMENT_PREREGISTRATION.splits.temporal.development[1]) return "development";
  if (year <= INDEX_TOURNAMENT_PREREGISTRATION.splits.temporal.validation[1]) return "validation";
  return "final_holdout";
}

export function jointTournamentSplit(iso3: string, year: number): BaselineOutput["split"] {
  const temporal = temporalSplit(year);
  const bucket = geographicTournamentBucket(iso3);
  const geographic = bucket <= 6 ? "development" : bucket <= 8 ? "validation" : "final_holdout";
  if (temporal === "final_holdout" || geographic === "final_holdout") return "final_holdout";
  if (temporal === "validation" || geographic === "validation") return "validation";
  return "development";
}

function groupRows(rows: readonly BaselinePanelObservation[]): Map<string, BaselinePanelObservation[]> {
  const groups = new Map<string, BaselinePanelObservation[]>();
  for (const row of rows) {
    const key = `${row.iso3}:${row.periodYear}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function orderedGroups(rows: readonly BaselinePanelObservation[]): BaselinePanelObservation[][] {
  return [...groupRows(rows).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => group);
}

function completeVector(rows: readonly BaselinePanelObservation[]): number[] | null {
  const bySource = new Map(rows.map((row) => [row.sourceId, row]));
  const vector = [];
  for (const sourceId of GOVERNANCE_BASELINE_SOURCES) {
    const row = bySource.get(sourceId);
    if (!row || row.value === null) return null;
    const bounded = (row.value - row.nativeMin) / (row.nativeMax - row.nativeMin);
    vector.push((row.isInverted ? 1 - bounded : bounded) * 100);
  }
  return vector;
}

function baseOutput(baselineId: BaselineOutput["baselineId"], rows: readonly BaselinePanelObservation[], value: number | null, scale: string, sources: readonly string[]): BaselineOutput {
  const first = rows[0];
  const present = new Set(rows.filter((row) => row.value !== null).map((row) => row.sourceId));
  return {
    baselineId,
    unitId: `${first.iso3}:${first.periodYear}`,
    iso3: first.iso3,
    periodYear: first.periodYear,
    split: jointTournamentSplit(first.iso3, first.periodYear),
    value,
    scale,
    inputSources: sources.filter((source) => present.has(source)),
    missingSources: GOVERNANCE_BASELINE_SOURCES.filter((source) => !present.has(source)),
    methodVersion: INDEX_BASELINE_IMPLEMENTATION_VERSION,
  };
}

export function dashboardBaseline(rows: readonly BaselinePanelObservation[]): BaselineOutput[] {
  return orderedGroups(rows).map((group) => baseOutput("B0", group, null, "no_score_native_observations", [...new Set(group.map((row) => row.sourceId))].sort()));
}

export function singleIndicatorBaseline(rows: readonly BaselinePanelObservation[]): BaselineOutput[] {
  return orderedGroups(rows).flatMap((group) => {
    const vdem = group.find((row) => row.sourceId === "vdem" && row.value !== null);
    return vdem ? [baseOutput("B1", group, vdem.value!, "vdem_native_0_1", ["vdem"])] : [];
  });
}

export function equalWeightBaseline(rows: readonly BaselinePanelObservation[]): BaselineOutput[] {
  return orderedGroups(rows).flatMap((group) => {
    const vector = completeVector(group);
    return vector ? [baseOutput("B2", group, vector.reduce((sum, value) => sum + value, 0) / vector.length, "common_scale_0_100", GOVERNANCE_BASELINE_SOURCES)] : [];
  });
}

function mean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function sampleSd(values: readonly number[], center: number): number { return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)); }

export function fitFirstFactorBaseline(rows: readonly BaselinePanelObservation[], tolerance = 1e-12, maxIterations = 10000): FactorModel {
  const matrix = orderedGroups(rows)
    .filter((group) => jointTournamentSplit(group[0].iso3, group[0].periodYear) === "development")
    .map(completeVector).filter((row): row is number[] => row !== null);
  if (matrix.length < 2) throw new Error("first-factor baseline requires at least two complete development rows");
  const means = GOVERNANCE_BASELINE_SOURCES.map((_, column) => mean(matrix.map((row) => row[column])));
  const standardDeviations = GOVERNANCE_BASELINE_SOURCES.map((_, column) => sampleSd(matrix.map((row) => row[column]), means[column]));
  if (standardDeviations.some((value) => !Number.isFinite(value) || value === 0)) throw new Error("first-factor baseline has a zero-variance input");
  const z = matrix.map((row) => row.map((value, column) => (value - means[column]) / standardDeviations[column]));
  const correlation = GOVERNANCE_BASELINE_SOURCES.map((_, i) => GOVERNANCE_BASELINE_SOURCES.map((__, j) => z.reduce((sum, row) => sum + row[i] * row[j], 0) / (z.length - 1)));
  let vector = GOVERNANCE_BASELINE_SOURCES.map(() => 1 / Math.sqrt(GOVERNANCE_BASELINE_SOURCES.length));
  let iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    const multiplied = correlation.map((row) => row.reduce((sum, value, j) => sum + value * vector[j], 0));
    const norm = Math.sqrt(multiplied.reduce((sum, value) => sum + value ** 2, 0));
    const next = multiplied.map((value) => value / norm);
    const distance = Math.sqrt(next.reduce((sum, value, i) => sum + (value - vector[i]) ** 2, 0));
    vector = next;
    if (distance < tolerance) break;
  }
  if (iterations === maxIterations) throw new Error("first-factor power iteration did not converge");
  if (vector.reduce((sum, value) => sum + value, 0) < 0) vector = vector.map((value) => -value);
  return { sourceOrder: GOVERNANCE_BASELINE_SOURCES, means, standardDeviations, loadings: vector, iterations: iterations + 1, tolerance, fitRows: matrix.length };
}

export function firstFactorBaseline(rows: readonly BaselinePanelObservation[], model: FactorModel): BaselineOutput[] {
  if (researchPanelHash(model.sourceOrder) !== researchPanelHash(GOVERNANCE_BASELINE_SOURCES)) throw new Error("factor model source order drifted");
  return orderedGroups(rows).flatMap((group) => {
    const vector = completeVector(group);
    if (!vector) return [];
    const z = vector.map((value, i) => (value - model.means[i]) / model.standardDeviations[i]);
    const value = z.reduce((sum, item, i) => sum + item * model.loadings[i], 0);
    return [baseOutput("B3", group, value, "development_fitted_first_factor_z", GOVERNANCE_BASELINE_SOURCES)];
  });
}

export function runAllTournamentBaselines(rows: readonly BaselinePanelObservation[]) {
  const factorModel = fitFirstFactorBaseline(rows);
  return {
    methodVersion: INDEX_BASELINE_IMPLEMENTATION_VERSION,
    indicatorContractHash: researchPanelHash(CI_RESEARCH_PANEL_INDICATORS.map(({ expectedInYear: _, ...row }) => row)),
    factorModel,
    outputs: {
      B0: dashboardBaseline(rows),
      B1: singleIndicatorBaseline(rows),
      B2: equalWeightBaseline(rows),
      B3: firstFactorBaseline(rows, factorModel),
    },
  };
}
