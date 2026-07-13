/**
 * Resolve the client IP for rate-limit bucketing. Vercel's `x-real-ip` is
 * preferred. The right-most forwarded hop is the fallback because the
 * left-most value can be client supplied. Missing headers share one
 * fail-closed `unknown` bucket.
 */
export function getRequestIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    const lastHop = hops[hops.length - 1];
    if (lastHop) return lastHop;
  }

  return "unknown";
}
