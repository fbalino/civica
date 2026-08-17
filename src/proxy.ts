import { after, NextResponse, type NextRequest } from "next/server";

import {
  recordRoutePerformanceObservation,
  requestPerformanceObservation,
  shouldRecordRequestPerformanceSample,
} from "@/lib/platform/route-performance-telemetry";

/**
 * PLT-016 captures only route-template timing after the response completes.
 * It is deliberately not an authorization, redirect, or request-rewrite
 * boundary. The application remains responsible for every security decision.
 *
 * Two limits keep this off the per-request hot path. The matcher below skips
 * the whole `_next/` tree and every static image/font extension, none of which
 * carry a route-performance signal, and the surviving requests contribute a
 * uniform random sample rather than one database row each.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "production") {
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
 * The exclusion is anchored on a trailing file extension, so it can only skip
 * static assets. Application routes and `/api/*` routes carry no extension and
 * still match, as do the two extension-bearing `/downloads/*` release routes,
 * whose `.json` / `.gz` suffixes are deliberately absent from the list.
 */
export const config = {
  matcher: [
    "/((?!_next/|favicon[.]ico|robots[.]txt|sitemap[.]xml|.*[.](?:webp|avif|png|jpg|jpeg|gif|svg|ico|woff2|woff|ttf|otf|eot)$).*)",
  ],
};
