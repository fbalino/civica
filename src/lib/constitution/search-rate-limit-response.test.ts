import assert from "node:assert/strict";
import test from "node:test";

import type { DurableRateLimitResult } from "@/lib/api/rate-limit";
import { constitutionSearchRateLimitResponse } from "./search-rate-limit-response";

const POLICY = {
  scope: "constitution-search",
  limit: 30,
  windowMs: 60_000,
} as const;

test("constitution search preserves its schema and shared 429 contract", async () => {
  const decision: DurableRateLimitResult = {
    status: "limited",
    allowed: false,
    remaining: 0,
    retryAfterMs: 1_001,
  };
  const response = constitutionSearchRateLimitResponse(decision, POLICY);

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Retry-After"), "2");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "30");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
  assert.deepEqual(await response.json(), {
    schemaVersion: "constitution-search/v1",
    error: "rate_limited",
    code: "RATE_LIMITED",
    message: "Rate limit exceeded. Try again shortly.",
  });
});

test("constitution search preserves its schema and shared fail-closed 503 contract", async () => {
  const decision: DurableRateLimitResult = {
    status: "store_unavailable",
    allowed: false,
    remaining: 0,
    retryAfterMs: null,
  };
  const response = constitutionSearchRateLimitResponse(decision, POLICY);

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Retry-After"), "5");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "30");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
  assert.deepEqual(await response.json(), {
    schemaVersion: "constitution-search/v1",
    error: "data_unavailable",
    code: "RATE_LIMIT_UNAVAILABLE",
    message: "Request protection is temporarily unavailable.",
  });
});
