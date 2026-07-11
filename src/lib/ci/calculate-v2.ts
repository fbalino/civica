/**
 * Civica Index — Beta calculation orchestrator.
 *
 * Reads raw indicator values from `ci_dimension_scores` for one explicit
 * methodology version, applies fixed-bound normalization and the versioned
 * missing-data policy, computes a deterministic weighted composite, and
 * writes the result under that same methodology version.
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
  isV2Dimension,
  type CIDimensionV2,
} from "./dimensions-v2";
import { normalizeV2 } from "./normalize-v2";
import { CI_BETA_COMPOSITE_ALGORITHM_VERSION, ciVersionEnvelope } from "./versioning";
import { assertSupersession, indexContentHash, parseIndexVintageLabel, stableStringify } from "../data/frozen-vintage";
import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";
import {
  assessCiCompleteness,
  type CiCompletenessFlag,
} from "./missingness-policy";

export const BETA_VERSION = CURRENT_CI_METHODOLOGY_VERSION;

export interface DimensionRow {
  jurisdictionId: string;
  dimension: string;
  rawValue: number | null;
  sourceId: string;
}

export type CompletenessFlag = CiCompletenessFlag;

export interface CompositeResult {
  jurisdictionId: string;
  scoreInteger: number;
  scoreLower: null;
  scoreUpper: null;
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
 * For partial CI the composite is computed using only the available
 * dimensions, with their weights re-proportioned (see `adjustedWeights`)
 * to sum to 1.00 over those dimensions only. The partial status remains
 * explicit because re-proportioning changes the
 * estimand and limits direct comparison with complete rows.
 *
 * KNOWN LIMITATION: re-proportioning can bias a partial score upward,
 * because the dimension most likely to be missing for a fragile or
 * low-capacity state is often the one that would have scored lowest.
 * No generic simulation range is used to disguise that bias. See published
 * methodology §7 and §12.
 */
export function classifyCompleteness(present: Set<string>): {
  completeness: CompletenessFlag;
  missing: CIDimensionV2[];
} {
  const { completeness, missing } = assessCiCompleteness(present);
  return { completeness, missing };
}

/** Re-proportion v2 weights to sum to 1.00 over the dimensions present. */
export function adjustedWeights(
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
 *
 * Pure and DB-free — production's `calculateCompositeV2` and the
 * documentation fixture (`src/lib/ci/__tests__/worked-examples.test.ts`)
 * both call this same function, so the published worked examples can
 * never drift from the scoring code that runs in production.
 *
 * No random generator enters the current point estimate.
 */
export function computeOne(
  rows: DimensionRow[],
): CompositeResult | null {
  // Reduce to v2 dimensions only — drop human_development and
  // stability_security (those go to Civica Conditions).
  const v2Rows = rows.filter((r) => isV2Dimension(r.dimension));

  const present = new Set(v2Rows.map((r) => r.dimension));
  const { completeness, missing } = classifyCompleteness(present);
  if (completeness === "insufficient") return null;

  const presentList = V2_DIMENSIONS.filter((d) => present.has(d));
  const weights = adjustedWeights(presentList);

  // Build deterministic composite inputs. Skip rows whose source isn't in the
  // fixed-bound table (defensive — should be a no-op in practice).
  const compositeInputs = v2Rows
    .map((r) => {
      if (r.rawValue === null) return null;
      const normalized = normalizeV2(r.rawValue, r.sourceId);
      if (normalized === null) return null;
      return {
        key: r.dimension,
        mean: normalized,
        weight: weights[r.dimension as CIDimensionV2] ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (compositeInputs.length === 0) return null;
  const score = compositeInputs.reduce(
    (sum, input) => sum + input.mean * input.weight,
    0,
  );

  return {
    jurisdictionId: rows[0].jurisdictionId,
    scoreInteger: Math.round(score),
    scoreLower: null,
    scoreUpper: null,
    completeness,
    dimensionsAvailable: compositeInputs.length,
    missingDimensions: missing,
  };
}

interface RunSummary {
  scored: number;
  unchanged: number;
  partial: number;
  insufficient: number;
  totalCountries: number;
}

/**
 * Read one explicit methodology's dimension rows for a quarter, compute v2
 * composites, and write them under that same version. Sets vintage_label for
 * display.
 */
export async function calculateCompositeV2(
  db: Db,
  quarter: string,
  opts: { vintageLabel?: string; supersedesVintageLabel?: string; methodologyVersion?: string } = {},
): Promise<RunSummary> {
  const vintageLabel = opts.vintageLabel ?? null;
  const methodologyVersion = opts.methodologyVersion ?? BETA_VERSION;
  const identity = vintageLabel ? parseIndexVintageLabel(vintageLabel) : null;
  if (identity && identity.period !== quarter) {
    throw new Error(`${vintageLabel} publishes ${identity.period}, not requested quarter ${quarter}.`);
  }
  if (identity && identity.methodologyVersion !== methodologyVersion.toLowerCase()) {
    throw new Error(`${vintageLabel} publishes methodology ${identity.methodologyVersion}, not ${methodologyVersion}.`);
  }

  const rows = await db
    .select({
      jurisdictionId: ciDimensionScores.jurisdictionId,
      dimension: ciDimensionScores.dimension,
      rawValue: ciDimensionScores.rawValue,
      sourceId: ciDimensionScores.sourceId,
    })
    .from(ciDimensionScores)
    .where(and(eq(ciDimensionScores.quarter, quarter), eq(ciDimensionScores.methodologyVersion, methodologyVersion)));

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
    const orderedDims = [...dims.values()].sort((a, b) =>
      `${a.dimension}:${a.sourceId}`.localeCompare(`${b.dimension}:${b.sourceId}`),
    );
    const result = computeOne(orderedDims);
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
  const existingRows = vintageLabel ? await db
    .select({
      jurisdictionId: ciCompositeScores.jurisdictionId,
      quarter: ciCompositeScores.quarter,
      score: ciCompositeScores.score,
      scoreLower: ciCompositeScores.scoreLower,
      scoreUpper: ciCompositeScores.scoreUpper,
      completenessFlag: ciCompositeScores.completenessFlag,
      vintageLabel: ciCompositeScores.vintageLabel,
      supersedesVintageLabel: ciCompositeScores.supersedesVintageLabel,
      contentHash: ciCompositeScores.contentHash,
      rank: ciCompositeScores.rank,
      totalRanked: ciCompositeScores.totalRanked,
      isPartial: ciCompositeScores.isPartial,
      dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
      missingDimensions: ciCompositeScores.missingDimensions,
      methodologyVersion: ciCompositeScores.methodologyVersion,
      derivationVersionKey: ciCompositeScores.derivationVersionKey,
      derivationVersions: ciCompositeScores.derivationVersions,
    })
    .from(ciCompositeScores)
    .where(and(eq(ciCompositeScores.quarter, quarter), eq(ciCompositeScores.methodologyVersion, methodologyVersion))) : [];
  const priorReleaseRows = vintageLabel ? await db
    .select({ vintageLabel: ciCompositeScores.vintageLabel })
    .from(ciCompositeScores)
    .where(eq(ciCompositeScores.quarter, quarter)) : [];
  const priorLabels = priorReleaseRows
    .map((row) => row.vintageLabel)
    .filter((label): label is string => Boolean(label && label !== vintageLabel));
  if (vintageLabel) {
    assertSupersession({ label: vintageLabel, supersedes: opts.supersedesVintageLabel, priorLabels });
  }
  const existingByJurisdiction = new Map(
    existingRows
      .filter((row) => row.vintageLabel === vintageLabel)
      .map((row) => [row.jurisdictionId, row]),
  );
  let unchanged = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const sourceIds = [...new Set([...(byJurisdiction.get(r.jurisdictionId)?.values() ?? [])].map((row) => row.sourceId))];
    const versions = ciVersionEnvelope({
      methodologyVersion,
      algorithmVersion: CI_BETA_COMPOSITE_ALGORITHM_VERSION,
      sourceIds,
    });
    const frozenFields = {
        jurisdictionId: r.jurisdictionId,
        quarter,
        score: r.scoreInteger,
        scoreLower: r.scoreLower,
        scoreUpper: r.scoreUpper,
        completenessFlag: r.completeness,
        vintageLabel,
        supersedesVintageLabel: opts.supersedesVintageLabel ?? null,
        rank: i + 1,
        totalRanked,
        isPartial: r.completeness === "partial",
        dimensionsAvailable: r.dimensionsAvailable,
        missingDimensions: r.missingDimensions,
        methodologyVersion,
        derivationVersionKey: versions.key,
        derivationVersions: versions.envelope,
    };
    const contentHash = vintageLabel ? indexContentHash(frozenFields) : null;
    const existing = existingByJurisdiction.get(r.jurisdictionId);
    if (existing && vintageLabel) {
      const comparable = {
        ...frozenFields,
        contentHash,
      };
      const stored = Object.fromEntries(
        Object.keys(comparable).map((key) => [key, existing[key as keyof typeof existing] ?? null]),
      );
      if (stableStringify(stored) !== stableStringify(comparable)) {
        const differingFields = Object.keys(comparable).filter(
          (key) => stableStringify(stored[key]) !== stableStringify(comparable[key as keyof typeof comparable]),
        );
        throw new Error(`Frozen Civica Index conflict for ${vintageLabel}/${r.jurisdictionId} in ${differingFields.join(", ")}; publish a new superseding version instead.`);
      }
      unchanged += 1;
      continue;
    }
    const insert = db
      .insert(ciCompositeScores)
      .values({
        ...frozenFields,
        contentHash,
      })
    if (vintageLabel) {
      await insert.onConflictDoNothing();
    } else {
      await insert.onConflictDoUpdate({
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
          supersedesVintageLabel: null,
          contentHash: null,
          rank: i + 1,
          totalRanked,
          isPartial: r.completeness === "partial",
          dimensionsAvailable: r.dimensionsAvailable,
          derivationVersionKey: versions.key,
          derivationVersions: versions.envelope,
          missingDimensions: r.missingDimensions,
          calculatedAt: dsql`NOW()`,
        },
      });
    }
  }

  return {
    scored: results.length,
    unchanged,
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
