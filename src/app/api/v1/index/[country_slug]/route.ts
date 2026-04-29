import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { db } from "@/lib/db";
import { getJurisdictionBySlug } from "@/lib/db/queries";
import {
  ciCompositeScores,
  ciDimensionScores,
} from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const slug = country_slug.toLowerCase();
    const jurisdiction = await getJurisdictionBySlug(slug);
    if (!jurisdiction) {
      return apiError("Country not found", 404);
    }

    const latestScore = await db
      .select()
      .from(ciCompositeScores)
      .where(eq(ciCompositeScores.jurisdictionId, jurisdiction.id))
      .orderBy(desc(ciCompositeScores.quarter))
      .limit(1);

    const composite = latestScore[0];
    if (!composite) {
      return apiError("No CI data available for this country", 404);
    }

    const dimensions = await db
      .select({
        dimension: ciDimensionScores.dimension,
        normalizedScore: ciDimensionScores.normalizedScore,
        rawValue: ciDimensionScores.rawValue,
        sourceId: ciDimensionScores.sourceId,
      })
      .from(ciDimensionScores)
      .where(
        sql`${ciDimensionScores.jurisdictionId} = ${jurisdiction.id}
          AND ${ciDimensionScores.quarter} = ${composite.quarter}
          AND ${ciDimensionScores.methodologyVersion} = ${composite.methodologyVersion}`
      );

    return apiResponse({
      data: {
        slug: jurisdiction.slug,
        name: jurisdiction.name,
        governmentClassification: jurisdiction.governmentClassification ?? null,
        quarter: composite.quarter,
        score: composite.score,
        rank: composite.rank,
        totalRanked: composite.totalRanked,
        isPartial: composite.isPartial,
        missingDimensions: composite.missingDimensions ?? [],
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
