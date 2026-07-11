import { researchPanelHash } from "./research-panel";
import { jointTournamentSplit } from "./tournament-baselines";

export const K2_CONCORDANCE_METHOD_VERSION = "k2-measurement-concordance/v1";
export const K2_CONSTRUCT_ID = "democratic_accountability_broad";
export const K2_RATERS = ["vdem:v2x_libdem", "worldbank_wgi:va.est", "freedom_house:pr_cl_total"] as const;

export const K2_CONCORDANCE_CONTRACT = Object.freeze({
  candidateId: "K2" as const,
  methodVersion: K2_CONCORDANCE_METHOD_VERSION,
  constructId: K2_CONSTRUCT_ID,
  raterEligibility: ["institutionally distinct publisher", "named public methodology", "broad cross-national coverage", "published country observations", "declared construct mapping", "source-dependence disclosure"],
  raters: K2_RATERS,
  minimumRaters: 3,
  transform: "within-year percentile over exact common coverage; average ranks for ties",
  dispersion: ["range", "linear IQR"],
  withinSourceUncertainty: "not retained in panel v3; absence shown separately from between-source spread",
  sourceDependenceCaveat: "Institutionally distinct publishers may share experts, evidence, concepts, or prior ratings; agreement is not independent corroboration or truth.",
  nonclaims: ["not country quality", "disagreement is not poor governance", "agreement is not truth", "no overall-country concordance score"],
  publicPresentation: "named-rater dot strip per construct, common-coverage note, spread, and a visible does-not-mean warning",
  artifactThreshold: "development midpoint-distance R2 < 0.70",
  stabilityThreshold: "final drop-one-source tercile changes <= 15%",
  expertPlan: "A blinded external list of at least 20 contested and 20 consensus cases; final AUC >= 0.80 and >= 0.05 above midpoint-distance and V-Dem-uncertainty baselines.",
});

export interface K2PanelInput { jurisdictionId: string; iso3: string; periodYear: number; sourceId: string; indicatorId: string; value: number | null; nativeMin: number; nativeMax: number; isInverted: boolean }
export interface K2ConcordanceOutput { candidateId: "K2"; unitId: string; iso3: string; periodYear: number; constructId: typeof K2_CONSTRUCT_ID; split: "development" | "validation" | "final_holdout"; commonCoverageN: number; placements: readonly { identity: string; percentile: number }[]; spreadRange: number; spreadIqr: number; meanPlacement: number; midpointDistance: number; uncertaintyStatus: "within_source_uncertainty_not_retained"; methodVersion: typeof K2_CONCORDANCE_METHOD_VERSION }

function quantile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p; const lower = Math.floor(position); const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function percentileMap(values: readonly { iso3: string; value: number }[]): Map<string, number> {
  const sorted = [...values].sort((a, b) => a.value - b.value || a.iso3.localeCompare(b.iso3));
  const result = new Map<string, number>();
  for (let start = 0; start < sorted.length;) {
    let end = start + 1; while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const averageRank = (start + 1 + end) / 2;
    const percentile = sorted.length === 1 ? 50 : ((averageRank - 1) / (sorted.length - 1)) * 100;
    for (let i = start; i < end; i++) result.set(sorted[i].iso3, percentile);
    start = end;
  }
  return result;
}

export function runK2Concordance(rows: readonly K2PanelInput[]): K2ConcordanceOutput[] {
  const byYear = new Map<number, K2PanelInput[]>(); for (const row of rows) byYear.set(row.periodYear, [...(byYear.get(row.periodYear) ?? []), row]);
  return [...byYear.entries()].sort(([a], [b]) => a - b).flatMap(([year, yearRows]) => {
    const byCountry = new Map<string, Map<string, K2PanelInput>>();
    for (const row of yearRows) { const identity = `${row.sourceId}:${row.indicatorId}`; if (!K2_RATERS.includes(identity as typeof K2_RATERS[number])) continue; const map = byCountry.get(row.iso3) ?? new Map(); map.set(identity, row); byCountry.set(row.iso3, map); }
    const common = [...byCountry.entries()].filter(([, map]) => K2_RATERS.every((identity) => map.get(identity)?.value !== null && map.get(identity)?.value !== undefined));
    if (common.length < 2) return [];
    const percentiles = new Map<string, Map<string, number>>();
    for (const identity of K2_RATERS) {
      const values = common.map(([iso3, map]) => { const row = map.get(identity)!; const bounded = (row.value! - row.nativeMin) / (row.nativeMax - row.nativeMin); return { iso3, value: row.isInverted ? 1 - bounded : bounded }; });
      percentiles.set(identity, percentileMap(values));
    }
    return common.sort(([a], [b]) => a.localeCompare(b)).map(([iso3]) => {
      const placements = K2_RATERS.map((identity) => ({ identity, percentile: percentiles.get(identity)!.get(iso3)! }));
      const ordered = placements.map((row) => row.percentile).sort((a, b) => a - b); const mean = ordered.reduce((sum, value) => sum + value, 0) / ordered.length;
      return { candidateId: "K2" as const, unitId: `${iso3}:${year}:${K2_CONSTRUCT_ID}`, iso3, periodYear: year, constructId: K2_CONSTRUCT_ID, split: jointTournamentSplit(iso3, year), commonCoverageN: common.length, placements, spreadRange: ordered.at(-1)! - ordered[0], spreadIqr: quantile(ordered, 0.75) - quantile(ordered, 0.25), meanPlacement: mean, midpointDistance: Math.abs(mean - 50), uncertaintyStatus: "within_source_uncertainty_not_retained" as const, methodVersion: K2_CONCORDANCE_METHOD_VERSION };
    });
  });
}

export function k2DevelopmentDiagnostics(outputs: readonly K2ConcordanceOutput[]) {
  const rows = outputs.filter((row) => row.split === "development");
  if (rows.length < 3) throw new Error("K2 diagnostics require at least three development outputs");
  const xMean = rows.reduce((s, r) => s + r.midpointDistance, 0) / rows.length; const yMean = rows.reduce((s, r) => s + r.spreadRange, 0) / rows.length;
  const covariance = rows.reduce((s, r) => s + (r.midpointDistance - xMean) * (r.spreadRange - yMean), 0); const variance = rows.reduce((s, r) => s + (r.midpointDistance - xMean) ** 2, 0);
  const slope = variance === 0 ? 0 : covariance / variance; const predicted = rows.map((r) => yMean + slope * (r.midpointDistance - xMean)); const total = rows.reduce((s, r) => s + (r.spreadRange - yMean) ** 2, 0); const residual = rows.reduce((s, r, i) => s + (r.spreadRange - predicted[i]) ** 2, 0);
  const thresholds = [quantile(rows.map((r) => r.spreadRange).sort((a, b) => a - b), 1 / 3), quantile(rows.map((r) => r.spreadRange).sort((a, b) => a - b), 2 / 3)];
  const tercile = (value: number) => value <= thresholds[0] ? 0 : value <= thresholds[1] ? 1 : 2;
  let unstable = 0;
  for (const row of rows) { const full = tercile(row.spreadRange); const values = row.placements.map((p) => p.percentile); const leaveOne = values.map((_, i) => { const kept = values.filter((__, j) => i !== j); return Math.max(...kept) - Math.min(...kept); }); if (leaveOne.some((value) => tercile(value) !== full)) unstable++; }
  return { developmentRows: rows.length, midpointArtifactR2: total === 0 ? 0 : 1 - residual / total, dropOneSourceAnyTercileChangeRate: unstable / rows.length, tercileThresholds: thresholds, diagnosticSha256: researchPanelHash(rows) };
}
