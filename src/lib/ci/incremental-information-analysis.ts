import { createHash } from "node:crypto";
import { researchPanelHash } from "./research-panel";
export interface PredictionRow {
  iso3: string;
  year: number;
  actual: number;
  predicted: number;
}
export function predictionMetrics(rows: readonly PredictionRow[]) {
  const mean = rows.reduce((s, r) => s + r.actual, 0) / rows.length;
  const sse = rows.reduce((s, r) => s + (r.actual - r.predicted) ** 2, 0);
  const sst = rows.reduce((s, r) => s + (r.actual - mean) ** 2, 0);
  return {
    n: rows.length,
    r2: 1 - sse / sst,
    rmse: Math.sqrt(sse / rows.length),
    mae:
      rows.reduce((s, r) => s + Math.abs(r.actual - r.predicted), 0) /
      rows.length,
  };
}
export function fitScalar(rows: readonly { target: number; value: number }[]) {
  const x = rows.reduce((s, r) => s + r.value, 0) / rows.length,
    y = rows.reduce((s, r) => s + r.target, 0) / rows.length;
  const slope =
    rows.reduce((s, r) => s + (r.value - x) * (r.target - y), 0) /
    rows.reduce((s, r) => s + (r.value - x) ** 2, 0);
  return { intercept: y - slope * x, slope };
}
function solve(a: number[][], b: number[]) {
  const n = b.length;
  const m = a.map((r, i) => [...r, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12)
      throw new Error("singular normal equation");
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const d = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= d;
    for (let r = 0; r < n; r++)
      if (r !== col) {
        const f = m[r][col];
        for (let j = col; j <= n; j++) m[r][j] -= f * m[col][j];
      }
  }
  return m.map((r) => r[n]);
}
export function fitOls(
  rows: readonly { target: number; features: readonly number[] }[],
) {
  const p = rows[0].features.length + 1;
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  for (const row of rows) {
    const x = [1, ...row.features];
    for (let i = 0; i < p; i++) {
      xty[i] += x[i] * row.target;
      for (let j = 0; j < p; j++) xtx[i][j] += x[i] * x[j];
    }
  }
  return solve(xtx, xty);
}
export function predictOls(
  coefficients: readonly number[],
  features: readonly number[],
) {
  return (
    coefficients[0] +
    features.reduce((s, v, i) => s + v * coefficients[i + 1], 0)
  );
}
function rng(seed: string) {
  let state = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function q(s: number[], p: number) {
  const pos = (s.length - 1) * p,
    l = Math.floor(pos),
    h = Math.ceil(pos);
  return s[l] + (s[h] - s[l]) * (pos - l);
}
export function predictionBootstrap(
  rows: readonly PredictionRow[],
  seed: string,
  iterations = 2000,
) {
  const groups = [...new Set(rows.map((r) => r.iso3))]
    .sort()
    .map((id) => rows.filter((r) => r.iso3 === id));
  const random = rng(`civica-index-incremental-bootstrap-v1:${seed}`);
  const values: { r2: number; rmse: number; mae: number }[] = [];
  for (let b = 0; b < iterations; b++) {
    const sample: PredictionRow[] = [];
    for (let i = 0; i < groups.length; i++)
      sample.push(...groups[Math.floor(random() * groups.length)]);
    values.push(predictionMetrics(sample));
  }
  const interval = (key: keyof (typeof values)[number]) => {
    const s = values.map((v) => v[key]).sort((a, b) => a - b);
    return { lower95: q(s, 0.025), upper95: q(s, 0.975) };
  };
  return {
    iterations,
    r2: interval("r2"),
    rmse: interval("rmse"),
    mae: interval("mae"),
    bootstrapSha256: researchPanelHash(values),
  };
}
