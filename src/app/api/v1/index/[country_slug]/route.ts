import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import {
  ciCompositeScores,
  ciDimensionScores,
} from "@/lib/db/schema";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";
import { and, eq, sql, desc } from "drizzle-orm";

/**
 * Phase 5.4 cut-over: this endpoint now serves Beta methodology data
 * by default. Pass `?methodology=v1.0` to fetch the legacy archive (kept
 * around for transparency; not advertised). All v2 fields — score_lower,
 * score_upper, band, completeness_flag, vintage_label — are returned
 * alongside the integer score.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();
    const url = new URL(request.url);
    const methodologyVersion = url.searchParams.get("methodology") ?? "beta";

    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) {
      return apiError("Country not found", 404);
    }

    // Fetch the latest score under the requested methodology. Falling
    // back to whatever's available preserves the API for the handful of
    // countries still missing Beta data.
    const latestScore = await db
      .select()
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
      return apiError(
        `No CI data available for this country under methodology "${methodologyVersion}".`,
        404,
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

    return apiResponse({
      data: {
        slug: jurisdiction.slug,
        name: jurisdiction.name,
        governmentClassification: jurisdiction.governmentClassification ?? null,
        quarter: composite.quarter,
        vintageLabel: composite.vintageLabel,
        score: composite.score,
        scoreLower: composite.scoreLower,
        scoreUpper: composite.scoreUpper,
        band: composite.band,
        completenessFlag: composite.completenessFlag,
        rank: composite.rank,
        totalRanked: composite.totalRanked,
        isPartial: composite.isPartial,
        missingDimensions: composite.missingDimensions ?? [],
        dimensionsAvailable: composite.dimensionsAvailable,
        methodologyVersion: composite.methodologyVersion,
        dimensions,
      },
      meta: { methodology: CI_METHODOLOGY_META },
    });
  } catch (e) {
    console.error("API /v1/index/[country_slug] error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
