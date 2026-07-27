import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CI_METHODOLOGY_META,
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { getCIMethodology } from "@/lib/db/queries";
import { shapeIndexMethodologyData } from "@/lib/api/contract/shapes";
import {
  INDEX_COMPOSITE_DEPRECATION_HEADERS,
  retiredIndexApiResponse,
  withIndexDispositionDeprecation,
} from "@/lib/api/deprecation";
import {
  CI_RELEASE_CONTRACTS,
  assertCiReleaseMethodologyRecord,
  isCiReleaseConsistencyError,
  publicCiReleaseIdentity,
} from "@/lib/ci/release-selection";
import { loadPublishedCiRelease } from "@/lib/ci/release-store";
import { parseQueryContract } from "@/lib/api/request-contract";
import { publicCiPublicationComponents } from "@/lib/ci/publication-components";

function publicMethodologyRecord<
  T extends { id: string; notes: string | null },
>(row: T) {
  return {
    ...row,
    notes: row.id.startsWith("beta")
      ? "Research-beta composite under active validation. Numeric estimates are secondary experimental outputs and are not categorical country grades."
      : "Archived methodology version retained for reproducibility; consult the current methodology for public interpretation guidance.",
  };
}

export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const query = parseQueryContract(request, "v1-index-methodology-query/v1", {
    errorHeaders: {
      ...CORS_HEADERS,
      ...INDEX_COMPOSITE_DEPRECATION_HEADERS,
    },
  });
  if (!query.ok) return query.response;
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const releaseId =
      query.data.release ??
      (query.data.version
        ? CI_RELEASE_CONTRACTS.find(
            (candidate) =>
              candidate.methodologyVersion === query.data.version,
          )!.releaseId
        : undefined);
    const release = await loadPublishedCiRelease(releaseId);
    const methodology = await getCIMethodology(release.methodologyVersion);
    if (!methodology) {
      return withIndexDispositionDeprecation(
        apiError("Methodology not found", 404),
      );
    }
    assertCiReleaseMethodologyRecord(methodology, release.releaseId);

    return withIndexDispositionDeprecation(
      apiResponse({
        data: shapeIndexMethodologyData(publicMethodologyRecord(methodology)),
        meta: {
          methodology: CI_METHODOLOGY_META,
          release: publicCiReleaseIdentity(release),
          series: release.series,
          components: publicCiPublicationComponents(release),
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/index/methodology error:", e);
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
