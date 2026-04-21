import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { compareCICountries } from "@/lib/db/queries";

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
    const results = await compareCICountries(slugs, quarter);

    return apiResponse({ data: results, meta: { quarter: quarter ?? null, count: results.length } });
  } catch (e) {
    console.error("API /v1/index/compare error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
