import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { getCICountryHistory } from "@/lib/db/queries";
import { shapeIndexHistoryItem } from "@/lib/api/contract/shapes";
import { retiredIndexApiResponse, withIndexDispositionDeprecation } from "@/lib/api/deprecation";

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

    const history = await getCICountryHistory(country_slug.toLowerCase());

    if (history.length === 0) {
      return withIndexDispositionDeprecation(apiError("Country not found or no history available", 404));
    }

    // CLM-012 fix: every sibling CI endpoint (rankings, index/[slug],
    // compare, methodology) attaches `meta.methodology`; this one had
    // silently omitted it.
    return withIndexDispositionDeprecation(apiResponse({
      data: history.map(shapeIndexHistoryItem),
      meta: { methodology: CI_METHODOLOGY_META },
    }));
  } catch (e) {
    console.error("API /v1/index/[country_slug]/history error:", e);
    return withIndexDispositionDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
