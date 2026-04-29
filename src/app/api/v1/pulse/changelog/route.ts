import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getPulseChangelog } from "@/lib/db/queries";
import { NextResponse } from "next/server";

/**
 * Phase 5.6 deprecation notice. The v1 changelog returns merged-
 * scalar event impacts. The Beta methodology publishes dimensional
 * deltas at /api/v1/pulse/changelog/v2. Legacy callers continue to
 * work until the 90-day sunset window closes.
 */
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Thu, 31 Dec 2026 00:00:00 GMT",
  Link: '</api/v1/pulse/changelog/v2>; rel="successor-version"',
};

function withDeprecation(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(DEPRECATION_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

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

    return withDeprecation(
      apiResponse({
        data: rows,
        meta: { limit, offset, hasMore: rows.length === limit },
      })
    );
  } catch (e) {
    console.error("API /v1/pulse/changelog error:", e);
    return withDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
