import { apiResponse, apiError, corsOptions, withRateLimit } from "@/lib/api/helpers";
import { getPulseHistory } from "@/lib/db/queries";
import { NextResponse } from "next/server";

/**
 * Phase 5.6 deprecation notice. The v1 per-country history returns
 * merged-scalar daily pulse scores. The Beta methodology publishes
 * dimensional deltas — see the v2 endpoints listed in the Sunset /
 * Deprecation headers below. Legacy callers continue to work until the
 * 90-day sunset window closes (2026-12-31).
 */
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Thu, 31 Dec 2026 00:00:00 GMT",
  Link: '</api/v1/pulse/{country_slug}/dimensions>; rel="successor-version"',
};

function withDeprecation(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(DEPRECATION_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

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
      return withDeprecation(
        apiError("Country not found or no pulse history available", 404)
      );
    }

    return withDeprecation(apiResponse({ data: rows, meta: { days } }));
  } catch (e) {
    console.error("API /v1/pulse/[country_slug]/history error:", e);
    return withDeprecation(apiError("Internal server error", 500));
  }
}

export async function OPTIONS() {
  return corsOptions();
}
