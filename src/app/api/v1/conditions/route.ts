import {
  apiError,
  apiResponse,
  CORS_HEADERS,
  corsOptions,
  withRateLimit,
} from "@/lib/api/helpers";
import { shapeConditionsReleaseResponse } from "@/lib/api/contract/shapes";
import { parseQueryContract } from "@/lib/api/request-contract";
import { getConditionsPublicRelease } from "@/lib/db/queries";

/**
 * GET /api/v1/conditions
 *
 * Returns one immutable Conditions release, selected either by its exact
 * release id or, when omitted, by the most recently created stored release.
 * Component values, reference years, source lineage, and unavailable/refused
 * states are returned together; callers must not reconstruct a release from
 * the generic country-metric tables.
 */
export async function GET(request: Request) {
  const rateLimited = await withRateLimit(request);
  if (rateLimited) return rateLimited;

  const query = parseQueryContract(request, "v1-conditions-query/v1", {
    errorHeaders: CORS_HEADERS,
  });
  if (!query.ok) return query.response;

  try {
    const release = await getConditionsPublicRelease(query.data.release);
    if (!release) {
      return apiError("Conditions release not found", 404);
    }
    return apiResponse(shapeConditionsReleaseResponse(release));
  } catch {
    return apiError("Conditions release is temporarily unavailable", 503);
  }
}

export async function OPTIONS() {
  return corsOptions();
}
