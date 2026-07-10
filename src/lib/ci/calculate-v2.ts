/**
 * Civica Index — Beta calculation orchestrator.
 *
 * Reads raw indicator values from `ci_dimension_scores` (any methodology
 * version), applies the v2 fixed-bound normalization, runs Monte Carlo
 * to derive the central input-variation range, applies the v2 missing-data
 * rules, and writes the result to `ci_composite_scores` under
 * `methodology_version='beta'`.
 *
 * The v1 calculation path (scripts/calculate-ci-composite.ts) is preserved for
 * reproducibility. Current Beta scores live alongside those archived rows in
 * `ci_composite_scores`, distinguished by `methodology_version`; public reads
 * default to Beta and use an explicit projection that excludes historical
 * presentation fields.
 */

import { sql as dsql, eq, and } from "drizzle-orm";
import type { Db } from "./ingest";
import { ciDimensionScores, ciCompositeScores } from "../db/schema";
import {
  V2_DIMENSIONS,
  V2_WEIGHTS,
  V2_MANDATORY,
  isV2Dimension,
  type CIDimensionV2,
} from "./dimensions-v2";
import { normalizeV2, defaultUncertaintyV2 } from "./normalize-v2";
import { simulateComposite, DEFAULT_SIMS } from "./monte-carlo";

const BETA_VERSION = "beta";

interface DimensionRow {
  jurisdictionId: string;
  dimension: string;
  rawValue: number | null;
  sourceId: string;
}

type CompletenessFlag = "full" | "partial" | "insufficient";

interface CompositeResult {
  jurisdictionId: string;
  scoreInteger: number;
  scoreLower: number;
  scoreUpper: number;
  completeness: CompletenessFlag;
  dimensionsAvailable: number;
  missingDimensions: CIDimensionV2[];
}

/**
 * Apply the v2 missing-data rules per spec §2.7.
 *
 * Returns:
 *   - "insufficient" if either mandatory dimension is missing → no CI
 *     row written for this country
 *   - "partial"      if mandatory dimensions are present but one of
 *                    the optional ones is missing
 *   - "full"         if all 4 dimensions are present
 *
 * v2 explicitly does NOT re-proportion missing weight onto remaining
 * dimensions, because that approach silently biases fragile states
 * upward (the dimensions most likely to be missing are the ones that
 * would have scored lowest).
 *
 * For partial CI the composite is computed using only the available
 * dimensions, with their weights re-proportioned to sum to 1.00 over
 * THOSE dimensions only — but the input-variation range is widened by
 * 20% to reflect the added uncertainty (spec §2.7).
 */
function classifyCompleteness(present: Set<string>): {
  completeness: CompletenessFlag;
  missing: CIDimensionV2[];
} {
  const missing = V2_DIMENSIONS.filter((d) => !present.has(d));
  const mandatoryMissing = V2_MANDATORY.some((d) => !present.has(d));
  if (mandatoryMissing) {
    return { completeness: "insufficient", missing };
  }
  if (missing.length === 0) {
    return { completeness: "full", missing };
  }
  return { completeness: "partial", missing };
}

/** Re-proportion v2 weights to sum to 1.00 over the dimensions present. */
function adjustedWeights(
  present: CIDimensionV2[],
): Record<CIDimensionV2, number> {
  const total = present.reduce((s, d) => s + V2_WEIGHTS[d], 0);
  if (total === 0) {
    return Object.fromEntries(present.map((d) => [d, 0])) as Record<
      CIDimensionV2,
      number
    >;
  }
  return Object.fromEntries(
    present.map((d) => [d, V2_WEIGHTS[d] / total]),
  ) as Record<CIDimensionV2, number>;
}

/**
 * Compute one country's v2 composite. Returns null if completeness is
 * insufficient (caller skips).
 */
function computeOne(rows: DimensionRow[], sims: number): CompositeResult | null {
  // Reduce to v2 dimensions only — drop human_development and
  // stability_security (those go to Civica Conditions).
  const v2Rows = rows.filter((r) => isV2Dimension(r.dimension));

  const present = new Set(v2Rows.map((r) => r.dimension));
  const { completeness, missing } = classifyCompleteness(present);
  if (completeness === "insufficient") return null;

  const presentList = V2_DIMENSIONS.filter((d) => present.has(d));
  const weights = adjustedWeights(presentList);

  // Build Monte Carlo inputs. Skip rows whose source isn't in the
  // fixed-bound table (defensive — should be a no-op in practice).
  const mcInputs = v2Rows
    .map((r) => {
      if (r.rawValue === null) return null;
      const normalized = normalizeV2(r.rawValue, r.sourceId);
      if (normalized === null) return null;
      const stdDev = defaultUncertaintyV2(r.sourceId);
      return {
        key: r.dimension,
        mean: normalized,
        stdDev,
        weight: weights[r.dimension as CIDimensionV2] ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (mcInputs.length === 0) return null;

  // Spec §2.7: partial estimates widen the input-variation range by 20%.
  const partialPenalty = completeness === "partial" ? 1.2 : 1.0;
  for (const input of mcInputs) {
    input.stdDev *= partialPenalty;
  }

  const mc = simulateComposite(mcInputs, sims);

  return {
    jurisdictionId: rows[0].jurisdictionId,
    scoreInteger: Math.round(mc.scoreMedian),
    scoreLower: Math.round(mc.lower),
    scoreUpper: Math.round(mc.upper),
    completeness,
    dimensionsAvailable: mcInputs.length,
    missingDimensions: missing,
  };
}

interface RunSummary {
  scored: number;
  partial: number;
  insufficient: number;
  totalCountries: number;
}

/**
 * Read all dimension rows for a quarter (any methodology version),
 * compute v2 composites, and write to `ci_composite_scores` under
 * methodology_version='beta'. Sets vintage_label for display.
 */
export async function calculateCompositeV2(
  db: Db,
  quarter: string,
  opts: { sims?: number; vintageLabel?: string } = {},
): Promise<RunSummary> {
  const sims = opts.sims ?? DEFAULT_SIMS;
  const vintageLabel = opts.vintageLabel ?? null;

  const rows = await db
    .select({
      jurisdictionId: ciDimensionScores.jurisdictionId,
      dimension: ciDimensionScores.dimension,
      rawValue: ciDimensionScores.rawValue,
      sourceId: ciDimensionScores.sourceId,
    })
    .from(ciDimensionScores)
    .where(eq(ciDimensionScores.quarter, quarter));

  // Group rows by jurisdiction. The dimension table can have multiple
  // rows for the same (jurisdiction, dimension) under different
  // methodology versions — dedup by keeping the first non-null
  // rawValue per (jurisdiction, dimension).
  const byJurisdiction = new Map<string, Map<string, DimensionRow>>();
  for (const r of rows) {
    if (r.rawValue === null) continue;
    const j = byJurisdiction.get(r.jurisdictionId) ?? new Map();
    if (!j.has(r.dimension)) {
      j.set(r.dimension, r);
    }
    byJurisdiction.set(r.jurisdictionId, j);
  }

  const results: CompositeResult[] = [];
  let insufficient = 0;
  for (const [, dims] of byJurisdiction) {
    const result = computeOne([...dims.values()], sims);
    if (!result) {
      insufficient++;
      continue;
    }
    results.push(result);
  }

  // Rank within the Beta result set. Tie-break on jurisdictionId
  // ascending so equal-score countries get stable, reproducible ranks
  // across recomputes (a raw score sort alone reshuffles ties each run).
  results.sort(
    (a, b) =>
      b.scoreInteger - a.scoreInteger ||
      a.jurisdictionId.localeCompare(b.jurisdictionId),
  );
  const totalRanked = results.length;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    await db
      .insert(ciCompositeScores)
      .values({
        jurisdictionId: r.jurisdictionId,
        quarter,
        score: r.scoreInteger,
        scoreLower: r.scoreLower,
        scoreUpper: r.scoreUpper,
        // Public grading was retired on 2026-07-09. Keep the nullable
        // historical column empty for every new or recomputed score.
        band: null,
        completenessFlag: r.completeness,
        vintageLabel,
        rank: i + 1,
        totalRanked,
        isPartial: r.completeness === "partial",
        dimensionsAvailable: r.dimensionsAvailable,
        missingDimensions: r.missingDimensions,
        methodologyVersion: BETA_VERSION,
      })
      .onConflictDoUpdate({
        target: [
          ciCompositeScores.jurisdictionId,
          ciCompositeScores.quarter,
          ciCompositeScores.methodologyVersion,
        ],
        set: {
          score: r.scoreInteger,
          scoreLower: r.scoreLower,
          scoreUpper: r.scoreUpper,
          band: null,
          completenessFlag: r.completeness,
          vintageLabel,
          rank: i + 1,
          totalRanked,
          isPartial: r.completeness === "partial",
          dimensionsAvailable: r.dimensionsAvailable,
          missingDimensions: r.missingDimensions,
          calculatedAt: dsql`NOW()`,
        },
      });
  }

  return {
    scored: results.length,
    partial: results.filter((r) => r.completeness === "partial").length,
    insufficient,
    totalCountries: byJurisdiction.size,
  };
}

/**
 * Convenience wrapper that picks the latest available quarter from
 * the DB if none is supplied.
 */
export async function latestQuarter(db: Db): Promise<string | null> {
  const rows = await db
    .select({ quarter: ciDimensionScores.quarter })
    .from(ciDimensionScores)
    .orderBy(dsql`${ciDimensionScores.quarter} DESC`)
    .limit(1);
  return rows[0]?.quarter ?? null;
}

/** Re-export `and` and `eq` so calling scripts don't need separate imports. */
export { and, eq };
