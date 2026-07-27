import { after, NextResponse, type NextRequest } from "next/server";

import {
  recordRoutePerformanceObservation,
  requestPerformanceObservation,
} from "@/lib/platform/route-performance-telemetry";

/**
 * PLT-016 captures only route-template timing after the response completes.
 * It is deliberately not an authorization, redirect, or request-rewrite
 * boundary. The application remains responsible for every security decision.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "production") {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
