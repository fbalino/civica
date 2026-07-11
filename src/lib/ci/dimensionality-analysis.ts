import { researchPanelHash } from "./research-panel";

export const DIMENSIONALITY_METHOD_VERSION = "civica-index-dimensionality/v1" as const;
export const DIMENSION_FEATURES = ["democratic_quality", "rule_of_law", "freedom_rights", "corruption_control"] as const;
export interface DimensionProfile { iso3: string; year: number; region: string | null; regime: string | null; values: readonly number[] }
export interface PcaResult { n: number; correlation: number[][]; eigenvalues: number[]; explainedVariance: number[]; pc1Loadings: number[]; pc1Orientation: "positive_sum" }

function mean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function identity(n: number): number[][] { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => i === j ? 1 : 0)); }

export function symmetricEigen(matrix: readonly (readonly number[])[], tolerance = 1e-12, maxIterations = 10000) {
  const n = matrix.length; if (n === 0 || matrix.some((row) => row.length !== n)) throw new Error("eigendecomposition requires a square matrix");
  const a = matrix.map((row) => [...row]); const vectors = identity(n); let iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    let p = 0; let q = 1; let largest = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(a[i][j]) > largest) { largest = Math.abs(a[i][j]); p = i; q = j; }
    if (largest < tolerance) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]); const c = Math.cos(angle); const s = Math.sin(angle);
    const app = c * c * a[p][p] - 2 * s * c * a[p][q] + s * s * a[q][q]; const aqq = s * s * a[p][p] + 2 * s * c * a[p][q] + c * c * a[q][q];
    for (let k = 0; k < n; k++) if (k !== p && k !== q) { const akp = a[k][p]; const akq = a[k][q]; a[k][p] = a[p][k] = c * akp - s * akq; a[k][q] = a[q][k] = s * akp + c * akq; }
    a[p][p] = app; a[q][q] = aqq; a[p][q] = a[q][p] = 0;
    for (let k = 0; k < n; k++) { const vkp = vectors[k][p]; const vkq = vectors[k][q]; vectors[k][p] = c * vkp - s * vkq; vectors[k][q] = s * vkp + c * vkq; }
  }
  if (iterations === maxIterations) throw new Error("Jacobi eigendecomposition did not converge");
  return Array.from({ length: n }, (_, i) => ({ value: a[i][i], vector: vectors.map((row) => row[i]) })).sort((x, y) => y.value - x.value);
}

export function pcaCorrelation(matrix: readonly (readonly number[])[]): PcaResult {
  if (matrix.length < 3) throw new Error("PCA slice requires at least three rows"); const columns = matrix[0].length; if (columns !== DIMENSION_FEATURES.length || matrix.some((row) => row.length !== columns)) throw new Error("PCA matrix shape differs from frozen feature set");
  const centers = Array.from({ length: columns }, (_, j) => mean(matrix.map((row) => row[j]))); const sds = centers.map((center, j) => Math.sqrt(matrix.reduce((sum, row) => sum + (row[j] - center) ** 2, 0) / (matrix.length - 1))); if (sds.some((sd) => !Number.isFinite(sd) || sd === 0)) throw new Error("PCA slice contains a zero-variance feature");
  const z = matrix.map((row) => row.map((value, j) => (value - centers[j]) / sds[j])); const correlation = Array.from({ length: columns }, (_, i) => Array.from({ length: columns }, (__, j) => z.reduce((sum, row) => sum + row[i] * row[j], 0) / (z.length - 1)));
  const eigen = symmetricEigen(correlation); let pc1 = eigen[0].vector; if (pc1.reduce((sum, value) => sum + value, 0) < 0) pc1 = pc1.map((value) => -value); const total = eigen.reduce((sum, row) => sum + row.value, 0);
  return { n: matrix.length, correlation, eigenvalues: eigen.map((row) => row.value), explainedVariance: eigen.map((row) => row.value / total), pc1Loadings: pc1, pc1Orientation: "positive_sum" };
}

function grouped<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> { const out = new Map<string, T[]>(); for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]); return out; }
function analyzeGroups(groups: Map<string, DimensionProfile[]>, minN: number) { return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([id, rows]) => rows.length >= minN ? [{ id, ...pcaCorrelation(rows.map((row) => row.values)) }] : []); }
function stability(reference: PcaResult, slices: readonly (PcaResult & { id: string })[]) { const cosine = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0) / Math.sqrt(a.reduce((sum, value) => sum + value ** 2, 0) * b.reduce((sum, value) => sum + value ** 2, 0)); const explained = slices.map((row) => row.explainedVariance[0]); const similarities = slices.map((row) => cosine(reference.pc1Loadings, row.pc1Loadings)); return { slices: slices.length, pc1ExplainedMin: Math.min(...explained), pc1ExplainedMax: Math.max(...explained), loadingCosineMinVsPooled: Math.min(...similarities), loadingCosineMaxVsPooled: Math.max(...similarities) }; }

export function runDimensionalityAnalysis(profiles: readonly DimensionProfile[]) {
  const pooled = pcaCorrelation(profiles.map((row) => row.values));
  const countryMeans = [...grouped(profiles, (row) => row.iso3).entries()].map(([iso3, rows]) => ({ iso3, year: 0, region: rows[0].region, regime: rows[0].regime, values: DIMENSION_FEATURES.map((_, j) => mean(rows.map((row) => row.values[j]))) }));
  const within = profiles.map((row) => { const group = grouped(profiles, (item) => item.iso3).get(row.iso3)!; return { ...row, values: row.values.map((value, j) => value - mean(group.map((item) => item.values[j]))) }; }).filter((row) => row.values.some((value) => Math.abs(value) > 1e-12));
  const changes = [...grouped(profiles, (row) => row.iso3).values()].flatMap((rows) => rows.sort((a, b) => a.year - b.year).slice(1).flatMap((row, i) => row.year === rows[i].year + 1 ? [{ ...row, values: row.values.map((value, j) => value - rows[i].values[j]) }] : []));
  const crossSections = analyzeGroups(grouped(profiles, (row) => String(row.year)), 30); const timeSlices = analyzeGroups(grouped(profiles, (row) => row.year <= 2016 ? "2012-2016" : row.year <= 2020 ? "2017-2020" : "2021-2024"), 30); const regions = analyzeGroups(grouped(profiles.filter((row) => row.region), (row) => row.region!), 30); const regimes = analyzeGroups(grouped(profiles.filter((row) => row.regime), (row) => row.regime!), 30);
  const result = {
    methodVersion: DIMENSIONALITY_METHOD_VERSION, features: DIMENSION_FEATURES, assumptions: ["Pearson correlation PCA on complete four-dimension native-bound normalized profiles", "No imputation or nearest-year substitution", "PC1 sign oriented to positive loading sum", "Region and regime slices are descriptive current-stratum groupings, not historical causal categories"],
    samples: { profiles: profiles.length, jurisdictions: new Set(profiles.map((row) => row.iso3)).size, years: [...new Set(profiles.map((row) => row.year))].sort(), withinRows: within.length, consecutiveChanges: changes.length },
    pooled, betweenCountry: pcaCorrelation(countryMeans.map((row) => row.values)), withinCountry: pcaCorrelation(within.map((row) => row.values)), firstDifferences: pcaCorrelation(changes.map((row) => row.values)),
    crossSections, timeSlices, regions, regimes,
    stability: { crossSections: stability(pooled, crossSections), timeSlices: stability(pooled, timeSlices), regions: stability(pooled, regions), regimes: stability(pooled, regimes) },
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
