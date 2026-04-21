import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getCIByGovernmentType } from "@/lib/db/queries";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const quarter = url.searchParams.get("quarter") ?? undefined;

    const result = await getCIByGovernmentType(quarter);
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows ?? [];

    return apiResponse({ data: rows, meta: { quarter: quarter ?? null } });
  } catch (e) {
    console.error("API /v1/index/by-government-type error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
