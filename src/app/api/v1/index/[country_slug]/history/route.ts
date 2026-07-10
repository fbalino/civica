import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { getCICountryHistory } from "@/lib/db/queries";
import { shapeIndexHistoryItem } from "@/lib/api/contract/shapes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;

    const history = await getCICountryHistory(country_slug.toLowerCase());

    if (history.length === 0) {
      return apiError("Country not found or no history available", 404);
    }

    // CLM-012 fix: every sibling CI endpoint (rankings, index/[slug],
    // compare, methodology) attaches `meta.methodology`; this one had
    // silently omitted it.
    return apiResponse({
      data: history.map(shapeIndexHistoryItem),
      meta: { methodology: CI_METHODOLOGY_META },
    });
  } catch (e) {
    console.error("API /v1/index/[country_slug]/history error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
