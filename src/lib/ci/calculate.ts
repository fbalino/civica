import { sql as dsql, eq, and } from "drizzle-orm";
import type { Db } from "./ingest";
import type { CIDimension } from "./types";
import {
  ciDimensionScores,
  ciCompositeScores,
  ciMethodologyVersions,
} from "../db/schema";

const ALL_DIMENSIONS: CIDimension[] = [
  "democratic_quality",
  "rule_of_law",
  "human_development",
  "freedom_rights",
  "corruption_control",
  "stability_security",
];

const MIN_DIMENSIONS_REQUIRED = 3;

interface DimensionRow {
  jurisdictionId: string;
  dimension: string;
  normalizedScore: number;
}

interface CompositeResult {
  jurisdictionId: string;
  score: number;
  isPartial: boolean;
  dimensionsAvailable: number;
  missingDimensions: string[];
}

function reProportionWeights(
  weights: Record<string, number>,
  available: string[]
): Record<string, number> {
  const totalAvailable = available.reduce((s, d) => s + (weights[d] ?? 0), 0);
  if (totalAvailable === 0) return {};
  const result: Record<string, number> = {};
  for (const d of available) {
    result[d] = (weights[d] ?? 0) / totalAvailable;
  }
  return result;
}

function computeComposite(
  dimensions: DimensionRow[],
  weights: Record<string, number>
): CompositeResult {
  const available = dimensions.map((d) => d.dimension);
  const missing = ALL_DIMENSIONS.filter((d) => !available.includes(d));

  if (available.length < MIN_DIMENSIONS_REQUIRED) {
    return {
      jurisdictionId: dimensions[0].jurisdictionId,
      score: 0,
      isPartial: true,
      dimensionsAvailable: available.length,
      missingDimensions: missing,
    };
  }

  const adjusted = reProportionWeights(weights, available);

  let score = 0;
  for (const dim of dimensions) {
    score += dim.normalizedScore * (adjusted[dim.dimension] ?? 0);
  }

  return {
    jurisdictionId: dimensions[0].jurisdictionId,
    score: Math.round(score * 10) / 10,
    isPartial: missing.length > 0,
    dimensionsAvailable: available.length,
    missingDimensions: missing,
  };
}

export async function calculateCompositeScores(
  db: Db,
  quarter: string,
  methodologyVersionId?: string
): Promise<{ calculated: number; skippedInsufficient: number }> {
  const versionId = methodologyVersionId ?? await getLatestVersion(db);

  const [methodology] = await db
    .select({ weights: ciMethodologyVersions.weights })
    .from(ciMethodologyVersions)
    .where(eq(ciMethodologyVersions.id, versionId));

  if (!methodology) {
    throw new Error(`Methodology version "${versionId}" not found`);
  }

  const weights = methodology.weights as Record<string, number>;

  const rows = await db
    .select({
      jurisdictionId: ciDimensionScores.jurisdictionId,
      dimension: ciDimensionScores.dimension,
      normalizedScore: ciDimensionScores.normalizedScore,
    })
    .from(ciDimensionScores)
    .where(
      and(
        eq(ciDimensionScores.quarter, quarter),
        eq(ciDimensionScores.methodologyVersion, versionId)
      )
    );

  const byJurisdiction = new Map<string, DimensionRow[]>();
  for (const row of rows) {
    const arr = byJurisdiction.get(row.jurisdictionId) ?? [];
    arr.push(row);
    byJurisdiction.set(row.jurisdictionId, arr);
  }

  const results: CompositeResult[] = [];
  let skippedInsufficient = 0;

  for (const [, dims] of byJurisdiction) {
    const result = computeComposite(dims, weights);
    if (result.dimensionsAvailable < MIN_DIMENSIONS_REQUIRED) {
      skippedInsufficient++;
      continue;
    }
    results.push(result);
  }

  results.sort((a, b) => b.score - a.score);

  const totalRanked = results.length;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    await db
      .insert(ciCompositeScores)
      .values({
        jurisdictionId: r.jurisdictionId,
        quarter,
        score: r.score,
        rank: i + 1,
        totalRanked,
        isPartial: r.isPartial,
        dimensionsAvailable: r.dimensionsAvailable,
        missingDimensions: r.missingDimensions,
        methodologyVersion: versionId,
      })
      .onConflictDoUpdate({
        target: [
          ciCompositeScores.jurisdictionId,
          ciCompositeScores.quarter,
          ciCompositeScores.methodologyVersion,
        ],
        set: {
          score: r.score,
          rank: i + 1,
          totalRanked,
          isPartial: r.isPartial,
          dimensionsAvailable: r.dimensionsAvailable,
          missingDimensions: r.missingDimensions,
          calculatedAt: dsql`NOW()`,
        },
      });
  }

  return { calculated: results.length, skippedInsufficient };
}

async function getLatestVersion(db: Db): Promise<string> {
  const rows = await db
    .select({ id: ciMethodologyVersions.id })
    .from(ciMethodologyVersions)
    .orderBy(dsql`${ciMethodologyVersions.publishedAt} DESC`)
    .limit(1);
  if (rows.length === 0) {
    throw new Error("No methodology version found. Run seed-ci-methodology first.");
  }
  return rows[0].id;
}
