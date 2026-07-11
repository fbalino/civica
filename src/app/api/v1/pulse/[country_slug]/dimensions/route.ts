/**
 * Phase 5.6 — v2 dimensional-delta endpoint for a single country.
 *
 * GET /api/v1/pulse/[country_slug]/dimensions
 *
 * Returns the per-dimension experimental heuristic with driving events, plus
 * the exact publication policy, method version, and limitations in metadata.
 */

import {
  apiResponse,
  apiError,
  corsOptions,
  withRateLimit,
  PULSE_METHODOLOGY_META,
} from "@/lib/api/helpers";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { shapePulseDimensionsData } from "@/lib/api/contract/shapes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> }
) {
  const rateLimited = withRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const { country_slug } = await params;
    const data = await getPulseV2ForCountry(country_slug);

    if (!data) return apiError("Country not found", 404);

    return apiResponse({
      data: shapePulseDimensionsData(data),
      meta: { methodology: PULSE_METHODOLOGY_META },
    });
  } catch (e) {
    console.error("API /v1/pulse/[country_slug]/dimensions error:", e);
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
