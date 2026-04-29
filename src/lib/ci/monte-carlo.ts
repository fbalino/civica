/**
 * Civica Index — Monte Carlo confidence interval simulator.
 *
 * Per spec §2.5: every score publishes a 90% confidence interval,
 * computed by:
 *   1. Sampling each indicator from a distribution centered on its
 *      reported value with spread equal to its published uncertainty
 *      (or a conservative ±5% default when not published).
 *   2. Recomputing the CI 10,000 times.
 *   3. Reporting the 5th and 95th percentile of the 10,000 simulated
 *      CIs as the [lower, upper] bound.
 *
 * For the Beta phase the implementation uses a normal distribution
 * with mean = the dimension's normalized score and standard deviation
 * = the source's defaultUncertainty (in 0–100 points). When sources
 * begin publishing per-country uncertainty (V-Dem already does), the
 * caller can pass an explicit `stdDev` per dimension.
 */

/** Default number of simulations. Spec §2.5 calls for 10,000. */
export const DEFAULT_SIMS = 10_000;

/**
 * Sample once from a normal distribution N(mean, stdDev) using the
 * Box-Muller transform. Returns a single sample.
 */
export function sampleNormal(mean: number, stdDev: number): number {
  // Box-Muller: two uniforms → one standard normal.
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + stdDev * z;
}

interface DimensionInput {
  /** Dimension key, e.g. "democratic_quality". */
  key: string;
  /** Mean (the country's normalized score for this dimension). */
  mean: number;
  /** Standard deviation in 0–100 points. */
  stdDev: number;
  /** Weight applied to this dimension in the composite. */
  weight: number;
}

interface MonteCarloResult {
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
 */
export function simulateComposite(
  dimensions: DimensionInput[],
  sims: number = DEFAULT_SIMS,
): MonteCarloResult {
  const samples: number[] = new Array(sims);
  for (let i = 0; i < sims; i++) {
    let composite = 0;
    for (const d of dimensions) {
      const sampled = Math.max(
        0,
        Math.min(100, sampleNormal(d.mean, d.stdDev)),
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
