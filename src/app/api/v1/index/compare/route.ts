import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { compareCICountries } from "@/lib/db/queries";
import { displayDimensionScore } from "@/lib/ci/normalize-v2";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const slugsParam = url.searchParams.getAll("slug");
    const quarter = url.searchParams.get("quarter") ?? undefined;

    if (slugsParam.length === 0) {
      return apiError("At least one `slug` query parameter is required", 400);
    }
    if (slugsParam.length > 10) {
      return apiError("Maximum 10 countries per comparison", 400);
    }

    const slugs = slugsParam.map((s) => s.toLowerCase());
    const rows = await compareCICountries(slugs, quarter);

    // Emit each per-dimension `normalizedScore` on the SAME v2 fixed-bound
    // scale as the headline composite, so this endpoint reconciles with the
    // /compare page, /api/v1/index/[slug], and the embed card (all of which
    // route rawValue/sourceId through displayDimensionScore). The stored
    // `normalized_score` column is the legacy v1 observed-min-max value and
    // does NOT sum to the v2 headline; fall back to it only when raw value /
    // source is missing. Mirrors src/app/api/v1/index/[country_slug]/route.ts
    // and src/components/compare/CompareCivicaIndex.tsx.
    const results = rows.map((row) => ({
      ...row,
      dimensions: row.dimensions.map((d) => ({
        ...d,
        normalizedScore:
          displayDimensionScore(d.rawValue, d.sourceId) ?? d.normalizedScore,
      })),
    }));

    return apiResponse({ data: results, meta: { quarter: quarter ?? null, count: results.length } });
  } catch (e) {
    console.error("API /v1/index/compare error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
