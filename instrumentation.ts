import type { Instrumentation } from "next";

/**
 * Global error telemetry is intentionally content-free. The captured route is
 * canonicalized before storage; error text, digest, headers, query values,
 * cookies, and caller identity never leave Next's error boundary.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  _error,
  request,
) => {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_RUNTIME === "edge"
  )
    return;
  try {
    const { recordRoutePerformanceObservation, serverErrorObservation } =
      await import("./src/lib/platform/route-performance-telemetry");
    await Promise.race([
      recordRoutePerformanceObservation(
        serverErrorObservation(request.path, request.method),
      ),
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
