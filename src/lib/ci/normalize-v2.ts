/**
 * Civica Index — Beta methodology fixed-bound normalization.
 *
 * Per spec §2.3: every source uses a different native scale, but
 * Civica normalizes them to 0–100 using FIXED THEORETICAL BOUNDS
 * rather than observed minimums and maximums. This stabilizes scores
 * across years — a country's normalized value won't shift just
 * because some other country's raw value changed.
 *
 * Each source has a hard-coded bounds table here. Adding a new source
 * to the CI core means adding an entry here.
 */

export type CISourceId =
  | "vdem"
  | "vdem_polyarchy"
  | "vdem_rule"
  | "worldbank_wgi"
  | "worldbank_wgi_corruption"
  | "freedom_house"
  | "transparency_intl"
  | "rsf_press_freedom"
  | "global_peace_index"
  | "undp_hdi";

interface SourceBounds {
  /** Native scale lower bound (theoretical, not observed). */
  nativeMin: number;
  /** Native scale upper bound (theoretical, not observed). */
  nativeMax: number;
  /** True if higher native value = WORSE outcome (e.g. GPI: 1.0 = most peaceful). */
  isInverted: boolean;
  /** Default ±uncertainty (in normalized 0–100 points) for Monte Carlo
   * sampling when the source doesn't publish per-country uncertainty.
   * Spec §2.5 recommends a conservative ±5%. */
  defaultUncertainty: number;
}

/**
 * Fixed-bound table per spec §2.3. The `vdem_*` and `worldbank_wgi_*`
 * variants are conceptually the same source family but they're keyed
 * separately so a single normalize() call can resolve the right
 * transform from the source_id stored on each ci_dimension_scores row.
 */
const BOUNDS: Record<CISourceId, SourceBounds> = {
  vdem: {
    nativeMin: 0.0,
    nativeMax: 1.0,
    isInverted: false,
    defaultUncertainty: 5,
  },
  vdem_polyarchy: {
    nativeMin: 0.0,
    nativeMax: 1.0,
    isInverted: false,
    defaultUncertainty: 5,
  },
  vdem_rule: {
    nativeMin: 0.0,
    nativeMax: 1.0,
    isInverted: false,
    defaultUncertainty: 5,
  },
  worldbank_wgi: {
    nativeMin: -2.5,
    nativeMax: 2.5,
    isInverted: false,
    defaultUncertainty: 5,
  },
  worldbank_wgi_corruption: {
    nativeMin: -2.5,
    nativeMax: 2.5,
    isInverted: false,
    defaultUncertainty: 5,
  },
  transparency_intl: {
    // CPI is 0–100, already on target scale.
    nativeMin: 0,
    nativeMax: 100,
    isInverted: false,
    defaultUncertainty: 5,
  },
  freedom_house: {
    // Freedom House Political Rights + Civil Liberties combined: sum of
    // two 1–7 scales (lower = more free). Range 2–14. Spec §2.3
    // formula: ((14 − score) / 12) × 100.
    nativeMin: 2,
    nativeMax: 14,
    isInverted: true,
    defaultUncertainty: 5,
  },
  rsf_press_freedom: {
    nativeMin: 0,
    nativeMax: 100,
    isInverted: false,
    defaultUncertainty: 5,
  },
  global_peace_index: {
    // GPI 1.0–5.0, lower = more peaceful (used in Civica Conditions,
    // not the CI headline; included here for completeness).
    nativeMin: 1.0,
    nativeMax: 5.0,
    isInverted: true,
    defaultUncertainty: 5,
  },
  undp_hdi: {
    // HDI 0.0–1.0 (used in Civica Conditions).
    nativeMin: 0.0,
    nativeMax: 1.0,
    isInverted: false,
    defaultUncertainty: 5,
  },
};

/**
 * Apply fixed-bound normalization to a raw source value, returning a
 * 0–100 score. If the source isn't in the bounds table, the function
 * returns null — caller must handle missing-source gracefully (the v2
 * pipeline skips countries with unrecognized sources).
 */
export function normalizeV2(
  rawValue: number,
  sourceId: string,
): number | null {
  const bounds = BOUNDS[sourceId as CISourceId];
  if (!bounds) return null;
  const { nativeMin, nativeMax, isInverted } = bounds;
  if (nativeMax === nativeMin) return 50;
  const value = isInverted
    ? ((nativeMax - rawValue) / (nativeMax - nativeMin)) * 100
    : ((rawValue - nativeMin) / (nativeMax - nativeMin)) * 100;
  // Clamp to [0, 100] in case a raw value falls slightly outside the
  // declared theoretical bounds (rare but possible — V-Dem occasionally
  // reports 1.001 etc).
  return Math.max(0, Math.min(100, value));
}

/**
 * Compute the per-dimension DISPLAY score (0–100) for the Civica Index
 * breakdown, using the SAME v2 fixed-bound normalization as the headline
 * composite (see `calculate-v2.ts` and published methodology §3).
 *
 * This is the single source of truth for every surface that renders the
 * dimension breakdown — the country page, the public API
 * (`/api/v1/index/[slug]`, `/api/v1/countries/[code]`), the embed card,
 * and `/compare` — so that the sum of (score × weight) reconciles with
 * the published headline.
 *
 * IMPORTANT: do NOT use the stored `ci_dimension_scores.normalized_score`
 * column for v2 display. That column is the legacy v1 observed-min-max
 * value written by `ingest.ts` and still consumed by the v1 composite in
 * `calculate.ts`; it neither sums to the v2 headline nor matches the
 * published transform table.
 *
 * Returns null only when the raw value is missing/NaN or its source isn't
 * in the v2 bounds table — in which case the dimension did not contribute
 * to the headline either, and the caller should hide the row or fall back
 * to the stored value.
 */
export function displayDimensionScore(
  rawValue: number | null | undefined,
  sourceId: string,
): number | null {
  if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) {
    return null;
  }
  return normalizeV2(rawValue, sourceId);
}

/**
 * Look up the default uncertainty (in normalized 0–100 points) for a
 * given source. Used by the Monte Carlo simulator when a per-country
 * uncertainty isn't published.
 */
export function defaultUncertaintyV2(sourceId: string): number {
  return BOUNDS[sourceId as CISourceId]?.defaultUncertainty ?? 5;
}

/**
 * A single source's normalization descriptor, read-only. Mirrors
 * `SourceBounds` plus the `sourceId` it was looked up under, so a
 * consumer never needs its own copy of the `BOUNDS` table.
 */
export interface NormalizationDescriptor {
  sourceId: CISourceId;
  nativeMin: number;
  nativeMax: number;
  isInverted: boolean;
  defaultUncertainty: number;
}

/**
 * Read-only accessor over the fixed-bound table (CLM-009 §3). `BOUNDS`
 * itself is never exported — every consumer that needs the native
 * scale / inversion / uncertainty for a source (or all of them) goes
 * through this function, so there is exactly one place that can ever
 * mutate the underlying table (there isn't one).
 */
export function normalizationDescriptors(): readonly NormalizationDescriptor[] {
  return (Object.keys(BOUNDS) as CISourceId[]).map((sourceId) => ({
    sourceId,
    ...BOUNDS[sourceId],
  }));
}

/** Single-source variant of `normalizationDescriptors()`. Returns
 *  `undefined` for an unrecognized source id. */
export function normalizationDescriptor(
  sourceId: string,
): NormalizationDescriptor | undefined {
  const bounds = BOUNDS[sourceId as CISourceId];
  if (!bounds) return undefined;
  return { sourceId: sourceId as CISourceId, ...bounds };
}
