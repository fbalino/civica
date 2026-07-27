import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkDurableRateLimit,
  type DurableRateLimitStore,
} from "./rate-limit";

const SUBJECT_HASH = "a".repeat(64);
const OPTIONS = {
  scope: "durable-test",
  subjectHash: SUBJECT_HASH,
  limit: 5,
  windowMs: 15 * 60 * 1000,
} as const;

function failingStore(): DurableRateLimitStore {
  return {
    async increment() {
      throw new Error("injected durable-store outage");
    },
  };
}

test("durable limiter distinguishes a shared-store outage without memory fallback", async () => {
  const result = await checkDurableRateLimit(OPTIONS, {
    store: failingStore(),
  });

  assert.deepEqual(result, {
    status: "store_unavailable",
    allowed: false,
    remaining: 0,
    retryAfterMs: null,
  });
});

test("durable limiter classifies a bounded over-limit store result", async () => {
  const store: DurableRateLimitStore = {
    async increment() {
      return { count: OPTIONS.limit + 1, retryAfterMs: 42_000 };
    },
  };

  const result = await checkDurableRateLimit(OPTIONS, {
    store,
  });

  assert.deepEqual(result, {
    status: "limited",
    allowed: false,
    remaining: 0,
    retryAfterMs: 42_000,
  });
});

test("raw identifiers are rejected before the durable store boundary", async () => {
  let incrementCalls = 0;
  const store: DurableRateLimitStore = {
    async increment() {
      incrementCalls++;
      return { count: 1, retryAfterMs: OPTIONS.windowMs };
    },
  };

  await assert.rejects(
    checkDurableRateLimit(
      { ...OPTIONS, subjectHash: "203.0.113.42" },
      { store },
    ),
    /subjectHash must be a lowercase 64-character hexadecimal digest/,
  );
  assert.equal(incrementCalls, 0);
});

test("invalid store output is reported as store unavailable", async () => {
  const store: DurableRateLimitStore = {
    async increment() {
      return { count: OPTIONS.limit + 2, retryAfterMs: 1 };
    },
  };

  const result = await checkDurableRateLimit(OPTIONS, {
    store,
  });

  assert.equal(result.status, "store_unavailable");
  assert.equal(result.allowed, false);
});
