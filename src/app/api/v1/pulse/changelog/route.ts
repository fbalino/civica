import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getPulseChangelog } from "@/lib/db/queries";

export async function GET(request: Request) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || 50, 1), 250);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    const result = await getPulseChangelog(undefined, limit, offset);
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows ?? [];

    return apiResponse({
      data: rows,
      meta: { limit, offset, hasMore: rows.length === limit },
    });
  } catch (e) {
    console.error("API /v1/pulse/changelog error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
