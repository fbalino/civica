import type { DurableRateLimitResult } from "@/lib/api/rate-limit";
import {
  checkRequestRateLimit,
  type RequestRateLimitDependencies,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";

export const ADMIN_LOGIN_RATE_LIMIT = getRequestRateLimitPolicy(
  "admin-credential-bootstrap",
);

export type AdminLoginRateLimitResult = DurableRateLimitResult;
export type AdminLoginRateLimitDependencies = RequestRateLimitDependencies;

/**
 * Apply the shared HMAC request boundary and Postgres-backed atomic counter to
 * password login attempts. Raw IP addresses never cross this helper, and any
 * subject/configuration/store failure returns the explicit unavailable state.
 */
export async function checkAdminLoginRateLimit(
  request: Request,
  dependencies: AdminLoginRateLimitDependencies = {},
): Promise<AdminLoginRateLimitResult> {
  return checkRequestRateLimit(request, ADMIN_LOGIN_RATE_LIMIT, dependencies);
}
