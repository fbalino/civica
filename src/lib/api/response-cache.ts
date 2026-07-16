import {
  cacheControlFor,
  type CacheProfileId,
} from "@/lib/platform/cache-consistency";

export type HttpResponseCacheProfileId = Exclude<
  CacheProfileId,
  "build-static" | "build-revalidated"
>;

/**
 * Apply one canonical HTTP cache profile to the final route response.
 *
 * This is intentionally a final-response boundary: it overwrites missing or
 * contradictory handler/helper headers while preserving the original body,
 * status, redirects, cookies, CORS headers, and content metadata.
 */
export function responseWithCacheProfile(
  response: Response,
  profileId: HttpResponseCacheProfileId,
): Response {
  response.headers.set("Cache-Control", cacheControlFor(profileId));
  return response;
}

/** Execute a route operation and seal every returned branch to one profile. */
export async function withResponseCacheProfile(
  profileId: HttpResponseCacheProfileId,
  operation: () => Response | Promise<Response>,
): Promise<Response> {
  return responseWithCacheProfile(await operation(), profileId);
}
