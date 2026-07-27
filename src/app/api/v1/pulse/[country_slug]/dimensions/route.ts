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
  CORS_HEADERS,
} from "@/lib/api/helpers";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { shapePulseDimensionsData } from "@/lib/api/contract/shapes";
import { parsePathContract } from "@/lib/api/request-contract";
import {
  isPulseReleaseConsistencyError,
  PULSE_DIMENSIONS_PUBLICATION_COMPONENTS,
} from "@/lib/pulse/v2/publication-consistency";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ country_slug: string }> },
) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;
  const path = await parsePathContract(params, "pulse-country-slug-params/v1", {
    errorHeaders: CORS_HEADERS,
  });
  if (!path.ok) return path.response;

  try {
    const { country_slug } = path.data;
    // PUBLIC_CLAIM: pulse.country-period-observability
    const result = await getPulseV2ForCountry(country_slug);

    if (!result) return apiError("Country not found", 404);
    const { publication, ...data } = result;

    return apiResponse({
      data: shapePulseDimensionsData(data),
      meta: {
        methodology: PULSE_METHODOLOGY_META,
        release: publication,
        components: PULSE_DIMENSIONS_PUBLICATION_COMPONENTS,
      },
    });
  } catch (e) {
    console.error("API /v1/pulse/[country_slug]/dimensions error:", e);
    if (isPulseReleaseConsistencyError(e)) {
      return apiError(
        "The published Pulse release is temporarily unavailable because its components do not agree.",
        503,
        "RELEASE_INCONSISTENT",
      );
    }
    return apiError("Internal server error", 500);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
