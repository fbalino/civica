import { createHash } from "node:crypto";

import { checkDurableRateLimit, getRequestIp } from "@/lib/api/rate-limit";

export const ADMIN_LOGIN_RATE_LIMIT = {
  scope: "admin-login",
  limit: 5,
  windowMs: 15 * 60 * 1000,
  failureMode: "deny",
} as const;

export interface AdminLoginRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

interface AdminLoginRateLimitOptions {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  failureMode: "deny";
}

export type AdminLoginRateLimitChecker = (
  options: AdminLoginRateLimitOptions,
) => Promise<AdminLoginRateLimitResult>;

/**
 * Hash the trusted request-IP resolution before it reaches shared storage.
 * The domain prefix prevents this digest from being reusable as another
 * feature's identifier, while the shared "unknown" bucket fails closed when
 * the deployment has no trusted IP header.
 */
export function adminLoginRateLimitKey(request: Request): string {
  return createHash("sha256")
    .update(`civica-admin-login-ip/v1:${getRequestIp(request)}`)
    .digest("hex");
}

/**
 * Apply the existing Postgres-backed, atomic cross-instance rate limiter to
 * password login attempts. This boundary opts into fail-closed store errors;
 * it never downgrades auth throttling to a per-instance counter. The checker is
 * injectable so tests never touch the live database or mutate a real bucket.
 */
export async function checkAdminLoginRateLimit(
  request: Request,
  checker: AdminLoginRateLimitChecker = checkDurableRateLimit,
): Promise<AdminLoginRateLimitResult> {
  return checker({
    ...ADMIN_LOGIN_RATE_LIMIT,
    key: adminLoginRateLimitKey(request),
  });
}
