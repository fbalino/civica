/**
 * Archived Civica Index Beta-R3 Monte Carlo simulator.
 *
 * Historical releases used a central-90% input-variation range, computed by:
 *   1. Sampling each indicator from a distribution centered on its
 *      reported value with spread equal to its published uncertainty
 *      (or a conservative ±5% default when not published).
 *   2. Recomputing the composite 10,000 times.
 *   3. Reporting the 5th and 95th percentile of the 10,000 simulated
 *      composites as the [lower, upper] bound.
 *
 * This is a sensitivity summary under declared perturbation
 * assumptions, not a calibrated confidence interval for a latent true
 * score — do not describe it as one in code, prose, or API output.
 *
 * Beta-R4 removed this model because its generic spreads and independence
 * assumption were not supported by released source uncertainty data. Current
 * production code must not import this module.
 */

/** Default number of simulations. Spec §2.5 calls for 10,000. */
export const DEFAULT_SIMS = 10_000;

/**
 * Sample once from a normal distribution N(mean, stdDev) using the
 * Box-Muller transform. Returns a single sample.
 *
 * Historical replay must provide an explicit seeded generator.
 */
export function sampleNormal(
  mean: number,
  stdDev: number,
  rng: () => number,
): number {
  // Box-Muller: two uniforms → one standard normal.
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = rng();
  while (u2 === 0) u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + stdDev * z;
}

export interface DimensionInput {
  /** Dimension key, e.g. "democratic_quality". */
  key: string;
  /** Mean (the country's normalized score for this dimension). */
  mean: number;
  /** Standard deviation in 0–100 points. */
  stdDev: number;
  /** Weight applied to this dimension in the composite. */
  weight: number;
}

export interface MonteCarloResult {
  /** Median of the simulation (used as the published point estimate). */
  scoreMedian: number;
  /** 5th percentile of the 10,000-sim distribution. */
  lower: number;
  /** 95th percentile of the 10,000-sim distribution. */
  upper: number;
  /** Number of simulations actually run (matches `sims` arg). */
  sims: number;
}

/**
 * Run a Monte Carlo simulation for one country's composite score.
 *
 * The dimensions array MUST already be re-proportioned/weighted for the
 * dimensions actually present (caller's responsibility). A country with
 * 3 of 4 dimensions present should pass an array of 3 entries whose
 * weights sum to 1.00 — the simulation will produce a 0–100 result.
 *
 * Inputs whose `mean` is outside [0, 100] are clamped after sampling
 * (a normal sample can drift below 0 or above 100; clamping prevents
 * the composite from going negative).
 *
 * Historical replay must provide an explicit seeded generator.
 */
export function simulateComposite(
  dimensions: DimensionInput[],
  sims: number,
  rng: () => number,
): MonteCarloResult {
  const samples: number[] = new Array(sims);
  for (let i = 0; i < sims; i++) {
    let composite = 0;
    for (const d of dimensions) {
      const sampled = Math.max(
        0,
        Math.min(100, sampleNormal(d.mean, d.stdDev, rng)),
      );
      composite += sampled * d.weight;
    }
    samples[i] = composite;
  }
  samples.sort((a, b) => a - b);
  const lower = samples[Math.floor(sims * 0.05)];
  const upper = samples[Math.floor(sims * 0.95)];
  const median = samples[Math.floor(sims * 0.5)];
  return {
    scoreMedian: median,
    lower,
    upper,
    sims,
  };
}
