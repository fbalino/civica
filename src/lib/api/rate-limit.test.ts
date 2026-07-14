import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkDurableRateLimit,
  type DurableRateLimitStore,
} from "./rate-limit";

const NOW_MS = Date.UTC(2026, 6, 13, 12, 7, 30);
const WINDOW_MS = 15 * 60 * 1000;

function failingStore(): DurableRateLimitStore {
  return {
    async increment() {
      throw new Error("injected durable-store outage");
    },
    async deleteExpired() {
      assert.fail("cleanup must not run after a failed increment");
    },
  };
}

test("durable limiter deterministically denies when an opted-in store fails", async () => {
  const windowStart = Math.floor(NOW_MS / WINDOW_MS) * WINDOW_MS;
  const result = await checkDurableRateLimit(
    {
      scope: "admin-login-test",
      key: "hashed-ip",
      limit: 5,
      windowMs: WINDOW_MS,
      failureMode: "deny",
    },
    {
      store: failingStore(),
      now: () => NOW_MS,
      random: () => 1,
    },
  );

  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterMs: windowStart + WINDOW_MS - NOW_MS,
  });
});

test("durable limiter preserves memory fallback as the default", async () => {
  const result = await checkDurableRateLimit(
    {
      scope: "rate-limit-default-fallback-test",
      key: "unique-test-key",
      limit: 5,
      windowMs: WINDOW_MS,
    },
    {
      store: failingStore(),
      now: () => NOW_MS,
      random: () => 1,
    },
  );

  assert.deepEqual(result, {
    allowed: true,
    remaining: 4,
    retryAfterMs: WINDOW_MS,
  });
});
