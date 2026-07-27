import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CI_METHODOLOGY_META,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { getCICountryHistory } from "@/lib/db/queries";
import { shapeIndexHistoryItem } from "@/lib/api/contract/shapes";
import {
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
} from "@/lib/api/deprecation";
import {
  isCiReleaseConsistencyError,
  publicCiReleaseIdentity,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";
import {
  parsePathContract,
  parseQueryContract,
} from "@/lib/api/request-contract";
import { publicCiPublicationComponents } from "@/lib/ci/publication-components";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> },
) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const errorHeaders = {
    ...CORS_HEADERS,
    ...INDEX_COMPOSITE_DEPRECATION_HEADERS,
  };
  const path = await parsePathContract(params, "jurisdiction-slug-params/v1", {
    errorHeaders,
  });
  if (!path.ok) return path.response;
  const query = parseQueryContract(request, "v1-index-history-query/v1", {
    errorHeaders,
  });
  if (!query.ok) return query.response;
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const country_slug = path.data.slug;
    const release = await loadPublishedCiRelease(query.data.release);

    const history = await getCICountryHistory(
      country_slug.toLowerCase(),
      release.releaseId,
    );

    if (history.length === 0) {
      return withIndexDispositionDeprecation(
        apiError("Country not found or no history available", 404),
      );
    }

    // CLM-012 fix: every sibling CI endpoint (rankings, index/[slug],
    // compare, methodology) attaches `meta.methodology`; this one had
    // silently omitted it.
    return withIndexDispositionDeprecation(
      apiResponse({
        data: history.map(shapeIndexHistoryItem),
        meta: {
          methodology: CI_METHODOLOGY_META,
          release: publicCiReleaseIdentity(release),
          series: release.series,
          components: publicCiPublicationComponents(release, {
            jurisdiction: "live_current",
          }),
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/index/[country_slug]/history error:", e);
    if (isCiReleaseConsistencyError(e)) {
      return withIndexDispositionDeprecation(
        apiError(
          "The requested release is temporarily unavailable.",
          503,
          "RELEASE_INCONSISTENT",
        ),
      );
    }
    return withIndexDispositionDeprecation(
      apiError("Internal server error", 500),
    );
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
