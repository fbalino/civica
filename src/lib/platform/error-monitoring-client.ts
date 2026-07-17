"use client";

type ClientBoundaryCode = "route_boundary" | "global_boundary";

/**
 * The browser sends only a closed boundary code and its current pathname. It
 * never serializes Error.message, Error.stack, React's digest, URL query,
 * browser metadata, or any user-entered value. The server immediately reduces
 * the pathname to a route template before retaining an event.
 */
export function reportClientBoundaryError(errorCode: ClientBoundaryCode): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    errorCode,
    routePath: window.location.pathname,
  });
  try {
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(
        "/api/observability/client-error",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    });
  } catch {
    // Client-side error reporting is intentionally best effort.
  }
}
