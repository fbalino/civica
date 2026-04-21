import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getPulseHistory } from "@/lib/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const days = Math.min(Math.max(parseInt(daysParam ?? "90", 10) || 90, 7), 365);

    const result = await getPulseHistory(country_slug.toLowerCase(), days);
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows ?? [];

    if (rows.length === 0) {
      return apiError("Country not found or no pulse history available", 404);
    }

    return apiResponse({ data: rows, meta: { days } });
  } catch (e) {
    console.error("API /v1/pulse/[country_slug]/history error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
