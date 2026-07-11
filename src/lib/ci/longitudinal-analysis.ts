import { createHash } from "node:crypto";
import { researchPanelHash } from "./research-panel";
export interface LongitudinalDatum {
  iso3: string;
  value: number;
}
function rng(seed: string) {
  let s = createHash("sha256").update(seed).digest().readUInt32BE(0);
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function quantile(values: readonly number[], p: number) {
  const s = [...values].sort((a, b) => a - b),
    x = (s.length - 1) * p,
    l = Math.floor(x),
    h = Math.ceil(x);
  return s[l] + (s[h] - s[l]) * (x - l);
}
export function median(values: readonly number[]) {
  return quantile(values, 0.5);
}
export function clusterInterval(
  rows: readonly LongitudinalDatum[],
  stat: (sample: readonly LongitudinalDatum[]) => number,
  seed: string,
  iterations = 2000,
) {
  const groups = [...new Set(rows.map((r) => r.iso3))]
      .sort()
      .map((id) => rows.filter((r) => r.iso3 === id)),
    random = rng(`civica-longitudinal-bootstrap-v1:${seed}`),
    values: number[] = [];
  for (let b = 0; b < iterations; b++) {
    const sample: LongitudinalDatum[] = [];
    for (let i = 0; i < groups.length; i++)
      sample.push(...groups[Math.floor(random() * groups.length)]);
    const v = stat(sample);
    if (Number.isFinite(v)) values.push(v);
  }
  values.sort((a, b) => a - b);
  return {
    iterationsRequested: iterations,
    iterationsValid: values.length,
    lower95: quantile(values, 0.025),
    upper95: quantile(values, 0.975),
    bootstrapSha256: researchPanelHash(values),
  };
}
export const directionAccuracy = (rows: readonly LongitudinalDatum[]) =>
  rows.filter((r) => r.value > 0).length / rows.length;
