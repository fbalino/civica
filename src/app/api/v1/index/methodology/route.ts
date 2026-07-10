import { apiResponse, apiError, corsOptions, withRateLimit, CI_METHODOLOGY_META } from "@/lib/api/helpers";
import { getCIMethodology } from "@/lib/db/queries";
import { shapeIndexMethodologyData } from "@/lib/api/contract/shapes";

function publicMethodologyRecord<T extends { id: string; notes: string | null }>(
  row: T,
) {
  return {
    ...row,
    notes:
      row.id === "beta"
        ? "Research-beta composite under active validation. Numeric estimates are secondary experimental outputs and are not categorical country grades."
        : "Archived methodology version retained for reproducibility; consult the current methodology for public interpretation guidance.",
  };
}

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const versionId = url.searchParams.get("version") ?? undefined;
    const methodology = await getCIMethodology(versionId);
    if (!methodology) {
      return apiError("Methodology not found", 404);
    }

    return apiResponse({
      data: shapeIndexMethodologyData(publicMethodologyRecord(methodology)),
      meta: { methodology: CI_METHODOLOGY_META },
    });
  } catch (e) {
    console.error("API /v1/index/methodology error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
