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
import { CI_RELEASE_CONTRACTS } from "@/lib/ci/release-selection";
import { parseQueryContract } from "@/lib/api/request-contract";

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
    const versionId = query.data.version;
    const methodology = await getCIMethodology(versionId);
    if (!methodology) {
      return withIndexDispositionDeprecation(
        apiError("Methodology not found", 404),
      );
    }

    return withIndexDispositionDeprecation(
      apiResponse({
        data: shapeIndexMethodologyData(publicMethodologyRecord(methodology)),
        meta: {
          methodology: CI_METHODOLOGY_META,
          series:
            CI_RELEASE_CONTRACTS.find(
              (release) => release.methodologyVersion === versionId,
            )?.series ?? null,
        },
      }),
    );
  } catch (e) {
    console.error("API /v1/index/methodology error:", e);
    return withIndexDispositionDeprecation(
      apiError("Internal server error", 500),
    );
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
