import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Verify that an incoming cron-endpoint request was triggered by Vercel Cron
 * (or an authorized operator). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 *
 * Returns null on success; returns a 401 NextResponse if the request is
 * unauthorized. The caller should: `const bad = requireCronAuth(req); if (bad) return bad;`.
 *
 * Security (2026-06 hardening): the bearer is compared in constant time
 * (`crypto.timingSafeEqual`) to avoid leaking the secret via response
 * timing, and error responses are generic — they never echo back config
 * state (e.g. whether CRON_SECRET is set) to an unauthenticated caller.
 */

/** Constant-time compare that tolerates length mismatches
 *  (timingSafeEqual throws when buffer lengths differ). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireCronAuth(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed when unconfigured, but don't disclose config state.
    // Returns 401 (not 500) for consistency with the admin bearer path —
    // an unauthenticated caller can't tell "server misconfigured" from
    // "wrong secret", which is the desired non-disclosure posture.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!safeEqual(header, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
