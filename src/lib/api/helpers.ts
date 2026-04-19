import { NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining };
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
  const { allowed } = checkRateLimit(key);

  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 60 requests per minute." },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "Retry-After": "60",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
