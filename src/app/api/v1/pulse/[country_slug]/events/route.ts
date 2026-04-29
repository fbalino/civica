/**
 * Phase 5.6 — v2 event list for a single country.
 *
 * GET /api/v1/pulse/[country_slug]/events
 *
 * Returns published + queued pulse_events_v2 rows for the country,
 * each joined with its source attribution.
 */

import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  CI_METHODOLOGY_META,
} from "@/lib/api/helpers";
import { getPulseV2EventsForCountry } from "@/lib/db/queries-pulse-v2";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const data = await getPulseV2EventsForCountry(country_slug);

    if (!data) return apiError("Country not found", 404);

    return apiResponse({
      data,
      meta: { methodology: CI_METHODOLOGY_META },
    });
  } catch (e) {
    console.error("API /v1/pulse/[country_slug]/events error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
