import { unstable_rethrow } from "next/navigation";
import {
  responseWithCacheProfile,
  type HttpResponseCacheProfileId,
} from "@/lib/api/response-cache";
import { apiProblem } from "@/lib/api/problem";
import {
  monitoringRouteId,
  recordErrorMonitoringEvent,
} from "@/lib/platform/error-monitoring";

export {
  API_PROBLEMS,
  apiProblem,
  type ApiProblemCode,
} from "@/lib/api/problem";

/**
 * Fixed unknown-error boundary for ordinary JSON routes. The exception is
 * logged server-side only; no caller-controlled or provider detail can enter
 * the response body or influence its status.
 */
export async function withSafeJsonErrors(
  operation: string,
  handler: () => Response | Promise<Response>,
  options: {
    errorHeaders?: HeadersInit;
    cacheProfileId?: HttpResponseCacheProfileId;
  } = {},
): Promise<Response> {
  const cacheProfileId = options.cacheProfileId ?? "public-live";
  try {
    const response = await handler();
    return responseWithCacheProfile(response, cacheProfileId);
  } catch (error) {
    // Preserve Next.js control-flow and dynamic-rendering signals while
    // converting only ordinary application failures to the public problem.
    unstable_rethrow(error);
    await recordErrorMonitoringEvent({
      surface: "server",
      routeId: monitoringRouteId(operation),
      errorCode: "route.unhandled",
    });
    console.error(`[${monitoringRouteId(operation)}] unhandled_route_failure`);
    return responseWithCacheProfile(
      apiProblem("DATA_UNAVAILABLE", {
        headers: options.errorHeaders,
      }),
      cacheProfileId,
    );
  }
}

/** Fixed-error boundary for authenticated or PII-bearing live routes. */
export function withPrivateSafeJsonErrors(
  operation: string,
  handler: () => Response | Promise<Response>,
  options: { errorHeaders?: HeadersInit } = {},
): Promise<Response> {
  return withSafeJsonErrors(operation, handler, {
    ...options,
    cacheProfileId: "private-live",
  });
}
