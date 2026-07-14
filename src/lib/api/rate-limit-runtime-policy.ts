import type { RequestRateLimitPolicy } from "./rate-limit-request";

export const DURABLE_RATE_LIMIT_POLICY_IDS = [
  "public-dynamic-read",
  "public-api-v1",
  "constitution-search",
  "public-dynamic-export",
  "chat-burst",
  "chat-sustained",
  "contact-form",
  "correction-form",
  "advisory-application-form",
  "admin-credential-bootstrap",
  "admin-oauth-bootstrap",
  "pulse-credential-bootstrap",
] as const;

export type DurableRateLimitPolicyId =
  (typeof DURABLE_RATE_LIMIT_POLICY_IDS)[number];

// Kept deliberately small: route bundles should not evaluate the full
// 100-route policy/audit registry. The focused parity test below closes this
// runtime table against that canonical registry.
const RUNTIME_RATE_LIMIT_POLICIES = {
  "public-dynamic-read": {
    scope: "public-dynamic-read",
    limit: 60,
    windowMs: 60_000,
  },
  "public-api-v1": { scope: "api-v1", limit: 60, windowMs: 60_000 },
  "constitution-search": {
    scope: "constitution-search",
    limit: 30,
    windowMs: 60_000,
  },
  "public-dynamic-export": {
    scope: "public-dynamic-export",
    limit: 30,
    windowMs: 60_000,
  },
  "chat-burst": { scope: "chat-burst", limit: 15, windowMs: 60_000 },
  "chat-sustained": {
    scope: "chat-sustained",
    limit: 100,
    windowMs: 60 * 60_000,
  },
  "contact-form": {
    scope: "contact-form",
    limit: 5,
    windowMs: 10 * 60_000,
  },
  "correction-form": {
    scope: "correction-form",
    limit: 5,
    windowMs: 10 * 60_000,
  },
  "advisory-application-form": {
    scope: "advisory-application-form",
    limit: 5,
    windowMs: 30 * 60_000,
  },
  "admin-credential-bootstrap": {
    scope: "admin-credential-bootstrap",
    limit: 5,
    windowMs: 15 * 60_000,
  },
  "admin-oauth-bootstrap": {
    scope: "admin-oauth-bootstrap",
    limit: 10,
    windowMs: 15 * 60_000,
  },
  "pulse-credential-bootstrap": {
    scope: "pulse-credential-bootstrap",
    limit: 5,
    windowMs: 15 * 60_000,
  },
} as const satisfies Record<DurableRateLimitPolicyId, RequestRateLimitPolicy>;

/** Resolve the reviewed registry definition into the minimal runtime shape. */
export function getRequestRateLimitPolicy(
  id: DurableRateLimitPolicyId,
): RequestRateLimitPolicy {
  return RUNTIME_RATE_LIMIT_POLICIES[id];
}
