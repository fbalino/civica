import assert from "node:assert/strict";
import test from "node:test";

import type {
  DurableRateLimitOptions,
  DurableRateLimitResult,
} from "./rate-limit";
import {
  checkRequestRateLimit,
  rateLimitResponse,
  type RequestRateLimitPolicy,
} from "./rate-limit-request";

const POLICY: RequestRateLimitPolicy = {
  scope: "test-policy",
  limit: 5,
  windowMs: 60_000,
};
const SUBJECT = "a".repeat(64);

test("request checks pass only an opaque subject to the durable store", async () => {
  let received: DurableRateLimitOptions | undefined;
  const request = new Request("https://civicaatlas.org/api/test", {
    headers: { "x-forwarded-for": "203.0.113.42" },
  });
  const result = await checkRequestRateLimit(request, POLICY, {
    subject: async () => SUBJECT,
    check: async (options) => {
      received = options;
      return {
        status: "allowed",
        allowed: true,
        remaining: 4,
        retryAfterMs: 0,
      };
    },
  });

  assert.equal(result.status, "allowed");
  assert.deepEqual(received, { ...POLICY, subjectHash: SUBJECT });
  assert.equal(JSON.stringify(received).includes("203.0.113.42"), false);
});

test("subject/configuration failures fail closed as store unavailable", async () => {
  const result = await checkRequestRateLimit(
    new Request("https://civicaatlas.org/api/test"),
    POLICY,
    {
      subject: async () => {
        throw new Error("missing key");
      },
      check: async () => {
        throw new Error("must not be reached");
      },
    },
  );
  assert.deepEqual(result, {
    status: "store_unavailable",
    allowed: false,
    remaining: 0,
    retryAfterMs: null,
  });
});

test("limited and unavailable decisions have distinct stable responses", async () => {
  const limited: DurableRateLimitResult = {
    status: "limited",
    allowed: false,
    remaining: 0,
    retryAfterMs: 1_001,
  };
  const limitedResponse = rateLimitResponse(limited, POLICY, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.headers.get("Retry-After"), "2");
  assert.equal(limitedResponse.headers.get("X-RateLimit-Limit"), "5");
  assert.equal(limitedResponse.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(await limitedResponse.json(), {
    error: "Rate limit exceeded. Try again shortly.",
    code: "RATE_LIMITED",
  });

  const unavailable: DurableRateLimitResult = {
    status: "store_unavailable",
    allowed: false,
    remaining: 0,
    retryAfterMs: null,
  };
  const unavailableResponse = rateLimitResponse(unavailable, POLICY);
  assert.equal(unavailableResponse.status, 503);
  assert.equal(unavailableResponse.headers.get("Retry-After"), "5");
  assert.deepEqual(await unavailableResponse.json(), {
    error: "Request protection is temporarily unavailable.",
    code: "RATE_LIMIT_UNAVAILABLE",
  });
});
