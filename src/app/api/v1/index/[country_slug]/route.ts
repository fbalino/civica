import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import {
  ciCompositeScores,
  ciDimensionScores,
} from "@/lib/db/schema";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { and, eq, sql, desc } from "drizzle-orm";
import { shapeIndexCountryData } from "@/lib/api/contract/shapes";

/**
 * This endpoint serves the current Beta methodology by default. Pass
 * `?methodology=v1.0` to reproduce an internal archived calculation. Current fields include the
 * input-variation range, completeness flag, and vintage label alongside the
 * integer score; categorical country grades are not part of the public shape.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return withStructuralFamilyDeprecation(rateLimited);

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();
    const url = new URL(request.url);
    const methodologyVersion = url.searchParams.get("methodology") ?? "beta";

    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) {
      return withStructuralFamilyDeprecation(apiError("Country not found", 404));
    }

    // Fetch the latest score under the requested methodology. Falling
    // back to whatever's available preserves the API for the handful of
    // countries still missing Beta data.
    const latestScore = await db
      .select({
        quarter: ciCompositeScores.quarter,
        score: ciCompositeScores.score,
        scoreLower: ciCompositeScores.scoreLower,
        scoreUpper: ciCompositeScores.scoreUpper,
        completenessFlag: ciCompositeScores.completenessFlag,
        vintageLabel: ciCompositeScores.vintageLabel,
        rank: ciCompositeScores.rank,
        totalRanked: ciCompositeScores.totalRanked,
        isPartial: ciCompositeScores.isPartial,
        dimensionsAvailable: ciCompositeScores.dimensionsAvailable,
        missingDimensions: ciCompositeScores.missingDimensions,
        methodologyVersion: ciCompositeScores.methodologyVersion,
      })
      .from(ciCompositeScores)
      .where(
        and(
          eq(ciCompositeScores.jurisdictionId, jurisdiction.id),
          eq(ciCompositeScores.methodologyVersion, methodologyVersion),
        ),
      )
      .orderBy(desc(ciCompositeScores.quarter))
      .limit(1);

    const composite = latestScore[0];
    if (!composite) {
      return withStructuralFamilyDeprecation(
        apiError(
          `No CI data available for this country under methodology "${methodologyVersion}".`,
          404,
        ),
      );
    }

    const dimensionRows = await db
      .select({
        dimension: ciDimensionScores.dimension,
        normalizedScore: ciDimensionScores.normalizedScore,
        rawValue: ciDimensionScores.rawValue,
        sourceId: ciDimensionScores.sourceId,
      })
      .from(ciDimensionScores)
      .where(
        sql`${ciDimensionScores.jurisdictionId} = ${jurisdiction.id}
          AND ${ciDimensionScores.quarter} = ${composite.quarter}`,
      );

    // Emit the per-dimension DISPLAY score on the SAME v2 fixed-bound
    // scale as the headline composite (see normalize-v2.ts), so this
    // endpoint reconciles with the country page, /compare, the embed
    // card, and /api/v1/countries. The stored `normalized_score` column
    // is the legacy v1 observed-min-max value and does NOT sum to the v2
    // headline; fall back to it only when raw value / source is missing.
    const dimensions = dimensionRows.map((d) => ({
      dimension: d.dimension,
      normalizedScore:
        displayDimensionScore(d.rawValue, d.sourceId) ?? d.normalizedScore,
      rawValue: d.rawValue,
      sourceId: d.sourceId,
    }));

    // This endpoint surfaces `governmentClassification`, which still
    // carries the deprecated `structuralFamily` / `structuralSubtype`
    // fields (retired per the 2026-05-02 peer-grouping resolution,
    // sunset 2027-03-31). Attach the same Deprecation/Sunset/Link
    // headers + `meta.deprecations` block every sibling structural
    // surface uses (rankings, countries) so consumers get one
    // consistent sunset signal.
    return withStructuralFamilyDeprecation(
      apiResponse({
        data: shapeIndexCountryData({
          slug: jurisdiction.slug,
          name: jurisdiction.name,
          governmentClassification: jurisdiction.governmentClassification ?? null,
          quarter: composite.quarter,
          vintageLabel: composite.vintageLabel,
          score: composite.score,
          scoreLower: composite.scoreLower,
          scoreUpper: composite.scoreUpper,
          completenessFlag: composite.completenessFlag,
          rank: composite.rank,
          totalRanked: composite.totalRanked,
          isPartial: composite.isPartial,
          missingDimensions: composite.missingDimensions ?? [],
          dimensionsAvailable: composite.dimensionsAvailable,
          methodologyVersion: composite.methodologyVersion,
          dimensions,
        }),
        meta: {
          methodology: CI_METHODOLOGY_META,
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/index/[country_slug] error:", e);
    return withStructuralFamilyDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
