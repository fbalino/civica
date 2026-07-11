import { createHash } from "node:crypto";
import { researchPanelHash } from "./research-panel";
import { INDEX_VALIDITY_PREREGISTRATION } from "./validity-preregistration";

export interface ValidityPair {
  iso3: string;
  year: number;
  x: number;
  y: number;
}
function averageRanks(values: readonly number[]): number[] {
  const indexed = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = Array(values.length);
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (end < indexed.length && indexed[end].value === indexed[start].value)
      end++;
    const rank = (start + 1 + end) / 2;
    for (let i = start; i < end; i++) ranks[indexed[i].index] = rank;
    start = end;
  }
  return ranks;
}
export function spearman(
  rows: readonly Pick<ValidityPair, "x" | "y">[],
): number {
  if (rows.length < 3) return NaN;
  const rx = averageRanks(rows.map((r) => r.x));
  const ry = averageRanks(rows.map((r) => r.y));
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length;
  const my = ry.reduce((a, b) => a + b, 0) / ry.length;
  const num = rx.reduce((s, v, i) => s + (v - mx) * (ry[i] - my), 0);
  const dx = Math.sqrt(rx.reduce((s, v) => s + (v - mx) ** 2, 0));
  const dy = Math.sqrt(ry.reduce((s, v) => s + (v - my) ** 2, 0));
  return dx === 0 || dy === 0 ? NaN : num / (dx * dy);
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
function quantile(sorted: readonly number[], p: number) {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export function clusterBootstrap(
  rows: readonly ValidityPair[],
  statistic: (sample: readonly ValidityPair[]) => number,
  seed: string,
  iterations = 2000,
) {
  const groups = [
    ...new Map(
      [...new Set(rows.map((r) => r.iso3))]
        .sort()
        .map((id) => [id, rows.filter((r) => r.iso3 === id)]),
    ).values(),
  ];
  const random = rng(
    `${INDEX_VALIDITY_PREREGISTRATION.estimation.seed}:${seed}`,
  );
  const estimates: number[] = [];
  for (let b = 0; b < iterations; b++) {
    const sample: ValidityPair[] = [];
    for (let i = 0; i < groups.length; i++)
      sample.push(...groups[Math.floor(random() * groups.length)]);
    const value = statistic(sample);
    if (Number.isFinite(value)) estimates.push(value);
  }
  estimates.sort((a, b) => a - b);
  return {
    iterationsRequested: iterations,
    iterationsValid: estimates.length,
    lower95: quantile(estimates, 0.025),
    upper95: quantile(estimates, 0.975),
    bootstrapSha256: researchPanelHash(estimates),
  };
}
export function median(values: readonly number[]) {
  const s = [...values].sort((a, b) => a - b);
  return quantile(s, 0.5);
}
