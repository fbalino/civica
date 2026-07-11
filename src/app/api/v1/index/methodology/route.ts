import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { getCIMethodology } from "@/lib/db/queries";
import { shapeIndexMethodologyData } from "@/lib/api/contract/shapes";
import { retiredIndexApiResponse, withIndexDispositionDeprecation } from "@/lib/api/deprecation";
import { CURRENT_CI_METHODOLOGY_VERSION } from "@/lib/ci/current-release";

function publicMethodologyRecord<T extends { id: string; notes: string | null }>(
  row: T,
) {
  return {
    ...row,
    notes:
      row.id.startsWith("beta")
        ? "Research-beta composite under active validation. Numeric estimates are secondary experimental outputs and are not categorical country grades."
        : "Archived methodology version retained for reproducibility; consult the current methodology for public interpretation guidance.",
  };
}

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return withIndexDispositionDeprecation(rateLimited);
  const retired = retiredIndexApiResponse();
  if (retired) return retired;

  try {
    const url = new URL(request.url);
    const versionId = url.searchParams.get("version") ?? CURRENT_CI_METHODOLOGY_VERSION;
    const methodology = await getCIMethodology(versionId);
    if (!methodology) {
      return withIndexDispositionDeprecation(apiError("Methodology not found", 404));
    }

    return withIndexDispositionDeprecation(apiResponse({
      data: shapeIndexMethodologyData(publicMethodologyRecord(methodology)),
      meta: { methodology: CI_METHODOLOGY_META },
    }));
  } catch (e) {
    console.error("API /v1/index/methodology error:", e);
    return withIndexDispositionDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return withIndexDispositionDeprecation(corsOptions());
}
