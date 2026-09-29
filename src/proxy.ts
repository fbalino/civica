import { after, NextResponse, type NextRequest } from "next/server";

import {
  isRequestTelemetryEligible,
  recordRoutePerformanceObservation,
  requestPerformanceObservation,
  shouldRecordRequestPerformanceSample,
} from "@/lib/platform/route-performance-telemetry";

/**
 * PLT-016 captures only route-template timing after the response completes.
 * It is deliberately not an authorization, redirect, or request-rewrite
 * boundary. The application remains responsible for every security decision.
 *
 * PLT-033 keeps this telemetry from waking the database. The matcher below
 * runs the proxy only for `/api/*`, so cached page documents, static assets,
 * and release downloads never reach it. Within `/api/*`, only request-live
 * route handlers, which query the database anyway, are eligible, and those
 * contribute a uniform random sample rather than one database row each.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  if (!isRequestTelemetryEligible(pathname, request.method)) {
    return NextResponse.next();
  }
  if (!shouldRecordRequestPerformanceSample()) {
    return NextResponse.next();
  }

  const startedAt = performance.now();
  after(async () => {
    await recordRoutePerformanceObservation(
      requestPerformanceObservation(
        pathname,
        request.method,
        performance.now() - startedAt,
      ),
    );
  });
  return NextResponse.next();
}

/**
 * Only route handlers under `/api/` can carry an eligible request. Page
 * documents, `_next/` assets, `public/` files, and `/downloads/*` releases
 * never invoke the proxy.
 */
export const config = {
  matcher: ["/api/:path*"],
};
