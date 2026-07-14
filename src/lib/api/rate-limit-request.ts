import { NextResponse } from "next/server";

import {
  checkDurableRateLimit,
  type DurableRateLimitOptions,
  type DurableRateLimitResult,
} from "./rate-limit";
import { getRateLimitSubject } from "./rate-limit-subject";

export type RequestRateLimitPolicy = Pick<
  DurableRateLimitOptions,
  "scope" | "limit" | "windowMs"
>;

export interface RequestRateLimitDependencies {
  subject?: (request: Request, scope: string) => Promise<string>;
  check?: (options: DurableRateLimitOptions) => Promise<DurableRateLimitResult>;
}

export interface RateLimitResponseOptions {
  headers?: HeadersInit;
  limitedMessage?: string;
}

/** Count one request against a shared policy without retaining its raw IP. */
export async function checkRequestRateLimit(
  request: Request,
  policy: RequestRateLimitPolicy,
  dependencies: RequestRateLimitDependencies = {},
): Promise<DurableRateLimitResult> {
  try {
    const subjectHash = await (dependencies.subject ?? getRateLimitSubject)(
      request,
      policy.scope,
    );
    return await (dependencies.check ?? checkDurableRateLimit)({
      ...policy,
      subjectHash,
    });
  } catch {
    // Configuration/HMAC failures are protection failures, not a reason to
    // run the protected work without a distributed budget.
    return {
      status: "store_unavailable",
      allowed: false,
      remaining: 0,
      retryAfterMs: null,
    };
  }
}

export function rateLimitResponse(
  decision: Exclude<DurableRateLimitResult, { status: "allowed" }>,
  policy: RequestRateLimitPolicy,
  options: RateLimitResponseOptions = {},
): NextResponse {
  const limited = decision.status === "limited";
  const retryAfter = limited
    ? Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    : 5;
  const headers = new Headers(options.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Retry-After", String(retryAfter));
  headers.set("X-RateLimit-Limit", String(policy.limit));
  headers.set("X-RateLimit-Remaining", "0");
  return NextResponse.json(
    limited
      ? {
          error:
            options.limitedMessage ?? "Rate limit exceeded. Try again shortly.",
          code: "RATE_LIMITED",
        }
      : {
          error: "Request protection is temporarily unavailable.",
          code: "RATE_LIMIT_UNAVAILABLE",
        },
    {
      status: limited ? 429 : 503,
      headers,
    },
  );
}

/** Return null when allowed, otherwise a stable 429 or honest fail-closed 503. */
export async function enforceRequestRateLimit(
  request: Request,
  policy: RequestRateLimitPolicy,
  options: RateLimitResponseOptions = {},
): Promise<NextResponse | null> {
  const decision = await checkRequestRateLimit(request, policy);
  return decision.status === "allowed"
    ? null
    : rateLimitResponse(decision, policy, options);
}
