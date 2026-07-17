import { NextResponse } from "next/server";

import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  clientErrorMonitoringBodySchema,
  REQUEST_BODY_LIMITS,
  type ClientErrorMonitoringBody,
} from "@/lib/api/request-body-schemas";
import { withSafeJsonErrors } from "@/lib/api/problem-response";
import { enforceRequestRateLimit } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { classifyRoutePerformanceRequest } from "@/lib/platform/route-performance-telemetry";
import { recordErrorMonitoringEvent } from "@/lib/platform/error-monitoring";

const CLIENT_ERROR_RATE_LIMIT = getRequestRateLimitPolicy("public-dynamic-read");

/**
 * Browser error boundaries call this endpoint with a closed code and pathname
 * only. It performs no reader-visible mutation and deliberately returns no
 * event identifier, error detail, or source-map data.
 */
export async function POST(request: Request) {
  return withSafeJsonErrors("api/observability/client-error", async () => {
    const limited = await enforceRequestRateLimit(request, CLIENT_ERROR_RATE_LIMIT);
    if (limited) return limited;

    const parsed = await parseBoundedRequestBody<ClientErrorMonitoringBody>(
      request,
      {
        maxBytes: REQUEST_BODY_LIMITS.clientErrorMonitoring,
        media: [{ mediaType: JSON_MEDIA_TYPE, schema: clientErrorMonitoringBodySchema }],
      },
    );
    if (!parsed.ok) return parsed.response;

    const route = classifyRoutePerformanceRequest(parsed.data.routePath, "GET");
    await recordErrorMonitoringEvent({
      surface: "client",
      routeId: route.routeId,
      errorCode: `client.${parsed.data.errorCode}`,
    });
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  });
}
