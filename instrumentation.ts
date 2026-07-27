import type { Instrumentation } from "next";

/**
 * Global error telemetry is intentionally content-free. The captured route is
 * canonicalized before storage; error text, digest, headers, query values,
 * cookies, and caller identity never leave Next's error boundary.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  _error,
  request,
  context,
) => {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_RUNTIME === "edge"
  )
    return;
  try {
    const [
      {
        recordRoutePerformanceObservation,
        serverErrorObservation,
        classifyRoutePerformanceRequest,
      },
      { recordErrorMonitoringEvent },
    ] = await Promise.all([
      import("./src/lib/platform/route-performance-telemetry"),
      import("./src/lib/platform/error-monitoring"),
    ]);
    // `routePath` is Next's template, unlike `request.path` which can contain
    // a reader-specific value. The event ledger never accepts the raw path.
    const route = classifyRoutePerformanceRequest(
      context.routePath,
      request.method,
    );
    await Promise.race([
      Promise.all([
        recordRoutePerformanceObservation(
          serverErrorObservation(context.routePath, request.method),
        ),
        recordErrorMonitoringEvent({
          surface: "server",
          routeId: route.routeId,
          errorCode: `next.${context.routeType}_error`,
        }),
      ]),
      new Promise<false>((resolve) => {
        setTimeout(() => resolve(false), 250);
      }),
    ]);
  } catch {
    // Error monitoring must never mask or replace the request's original
    // failure path, and must not log the original error content here.
    console.error("[route-performance] telemetry_error_capture_failed");
  }
};
