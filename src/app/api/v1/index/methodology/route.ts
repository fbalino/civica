import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getCIMethodology, getCIMethodologyHistory } from "@/lib/db/queries";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const versionId = url.searchParams.get("version") ?? undefined;
    const history = url.searchParams.get("history") === "true";

    if (history) {
      const versions = await getCIMethodologyHistory();
      return apiResponse({ data: versions });
    }

    const methodology = await getCIMethodology(versionId);
    if (!methodology) {
      return apiError("Methodology not found", 404);
    }

    return apiResponse({ data: methodology });
  } catch (e) {
    console.error("API /v1/index/methodology error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
