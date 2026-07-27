import type { DurableRateLimitResult } from "@/lib/api/rate-limit";
import type { RequestRateLimitPolicy } from "@/lib/api/rate-limit-request";
import {
  CONSTITUTION_SEARCH_SCHEMA_VERSION,
  type ConstitutionSearchErrorResponse,
} from "./search-contract";

type DeniedRateLimitDecision = Exclude<
  DurableRateLimitResult,
  { status: "allowed" }
>;

/**
 * Preserve the versioned constitution-search error envelope while applying
 * the shared rate-limit status, code, and header contract.
 */
export function constitutionSearchRateLimitResponse(
  decision: DeniedRateLimitDecision,
  policy: RequestRateLimitPolicy,
): Response {
  const limited = decision.status === "limited";
  const retryAfter = limited
    ? Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    : 5;
  const body: ConstitutionSearchErrorResponse = limited
    ? {
        schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
        error: "rate_limited",
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Try again shortly.",
      }
    : {
        schemaVersion: CONSTITUTION_SEARCH_SCHEMA_VERSION,
        error: "data_unavailable",
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Request protection is temporarily unavailable.",
      };

  return Response.json(body, {
    status: limited ? 429 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(policy.limit),
      "X-RateLimit-Remaining": "0",
    },
  });
}
