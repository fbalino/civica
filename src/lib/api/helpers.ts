import { NextResponse } from "next/server";
import { civicaIndex } from "@/lib/content/site-state";
import { checkInMemoryRateLimit, getRequestIp } from "@/lib/api/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Methodology status metadata for CI + Pulse API endpoints.
 *
 * The Civica Index is in active methodology development. Published
 * scores carry a "Beta" status flag; the cut-over to the published
 * methodology described at /civica-index/methodology is targeted
 * for `civicaIndex.cutoverTarget`. Citations follow the year-quarter
 * convention (e.g. "Civica Index 2026 Q3 (Beta)") — there is no
 * public version number.
 *
 * Endpoints that surface CI or Pulse data include this object as
 * `meta.methodology` in their response envelope so machine consumers
 * can detect the development phase and the cut-over window.
 *
 * Drives off `state.civicaIndex.{status, lastRevisionIso, cutoverTargetIso}`
 * so a single state-file edit propagates to every API endpoint.
 */
export const CI_METHODOLOGY_META = Object.freeze({
  status: civicaIndex.status,
  last_revised: civicaIndex.lastRevisionIso,
  cutover_target: civicaIndex.cutoverTargetIso,
  reference: "https://civicaatlas.org/civica-index/methodology",
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function getRateLimitKey(request: Request): string {
  return getRequestIp(request);
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

export function withRateLimit(request: Request): NextResponse | null {
  const key = getRateLimitKey(request);
  const { allowed, retryAfterSeconds } = checkInMemoryRateLimit({
    scope: "api-v1",
    key,
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
