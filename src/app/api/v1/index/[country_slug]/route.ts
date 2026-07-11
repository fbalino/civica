import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import {
  ciCompositeScores,
  ciDimensionScores,
} from "@/lib/db/schema";
import { displayCiReleaseDimensionScore, resolveCiRelease, selectCiReleaseDimensionRows } from "@/lib/ci/release-selection";
import {
  STRUCTURAL_FAMILY_DEPRECATION_META,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
  withStructuralFamilyDeprecation,
} from "@/lib/api/deprecation";
import { and, eq, sql } from "drizzle-orm";
import { shapeIndexCountryData } from "@/lib/api/contract/shapes";
import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import { parsePublishedCiCompleteness } from "@/lib/ci/missingness-policy";

/**
 * This endpoint serves the current closed release by default. Pass an exact
 * registered `?release=...` to reproduce an archived calculation. Current fields include the
 * uncertainty posture, completeness flag, and vintage label alongside the
 * integer score; categorical country grades are not part of the public shape.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();
    const url = new URL(request.url);
    const release = resolveCiRelease(url.searchParams.get("release") ?? CURRENT_CI_RELEASE_ID);
    const methodologyVersion = release.methodologyVersion;

    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) {
      return withIndexDispositionDeprecation(withStructuralFamilyDeprecation(apiError("Country not found", 404)));
    }

    // The release contract chooses one exact methodology/quarter coordinate.
    // Missing data stays missing; this endpoint never falls through to another release.
    const releaseScore = await db
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
          eq(ciCompositeScores.quarter, release.quarter),
        ),
      )
      .limit(1);

    const composite = releaseScore[0];
    if (!composite) {
      return withIndexDispositionDeprecation(withStructuralFamilyDeprecation(
        apiError(
          `No CI data available for this country in release "${release.releaseId}".`,
          404,
        ),
      ));
    }

    const dimensionRows = await db
      .select({
        jurisdictionId: ciDimensionScores.jurisdictionId,
        dimension: ciDimensionScores.dimension,
        normalizedScore: ciDimensionScores.normalizedScore,
        rawValue: ciDimensionScores.rawValue,
        sourceId: ciDimensionScores.sourceId,
        indicatorId: ciDimensionScores.indicatorId,
        quarter: ciDimensionScores.quarter,
        methodologyVersion: ciDimensionScores.methodologyVersion,
        transformationId: ciDimensionScores.transformationId,
        methodVersion: ciDimensionScores.methodVersion,
        artifactHash: ciDimensionScores.artifactHash,
      })
      .from(ciDimensionScores)
      .where(
        sql`${ciDimensionScores.jurisdictionId} = ${jurisdiction.id}
          AND ${ciDimensionScores.quarter} = ${release.quarter}
          AND ${ciDimensionScores.methodologyVersion} = ${release.methodologyVersion}`,
      );

    // Emit the per-dimension DISPLAY score on the SAME v2 fixed-bound
    // scale as the headline composite (see normalize-v2.ts), so this
    // endpoint reconciles with the country page, /compare, the embed
    // card, and /api/v1/countries. The stored `normalized_score` column
    // is the legacy v1 observed-min-max value and does NOT sum to the v2
    // headline; fall back to it only when raw value / source is missing.
    const dimensions = selectCiReleaseDimensionRows(dimensionRows, release.releaseId).map((d) => ({
      dimension: d.dimension,
      normalizedScore:
        displayCiReleaseDimensionScore(d, release.releaseId) ?? d.normalizedScore,
      rawValue: d.rawValue,
      sourceId: d.sourceId,
      valueStatus: "observed" as const,
    }));
    const completeness = parsePublishedCiCompleteness(composite);

    // This endpoint surfaces `governmentClassification`, which still
    // carries the deprecated `structuralFamily` / `structuralSubtype`
    // fields (retired per the 2026-05-02 peer-grouping resolution,
    // sunset 2027-03-31). Attach the same Deprecation/Sunset/Link
    // headers + `meta.deprecations` block every sibling structural
    // surface uses (rankings, countries) so consumers get one
    // consistent sunset signal.
    return withIndexDispositionDeprecation(withStructuralFamilyDeprecation(
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
          completenessFlag: completeness.completenessFlag,
          rank: composite.rank,
          totalRanked: composite.totalRanked,
          isPartial: composite.isPartial,
          missingDimensions: completeness.missingDimensions,
          dimensionsAvailable: completeness.dimensionsAvailable,
          methodologyVersion: composite.methodologyVersion,
          dimensions,
        }),
        meta: {
          methodology: CI_METHODOLOGY_META,
          ...STRUCTURAL_FAMILY_DEPRECATION_META,
        },
      }),
    ));
  } catch (e) {
    console.error("API /v1/index/[country_slug] error:", e);
    return withIndexDispositionDeprecation(withStructuralFamilyDeprecation(apiError("Internal server error", 500)));
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
