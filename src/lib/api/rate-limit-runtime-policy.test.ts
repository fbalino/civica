import assert from "node:assert/strict";
import test from "node:test";

import { RATE_LIMIT_POLICIES } from "./rate-limit-policy";
import {
  V1_RATE_LIMIT_MAX,
  V1_RATE_LIMIT_WINDOW_MS,
  EXPORT_RATE_LIMIT_MAX,
  EXPORT_RATE_LIMIT_WINDOW_MS,
} from "./contract/rate-limits";
import {
  DURABLE_RATE_LIMIT_POLICY_IDS,
  getRequestRateLimitPolicy,
} from "./rate-limit-runtime-policy";

test("every runtime policy id resolves exactly one durable registry policy", () => {
  const durableRegistryIds = RATE_LIMIT_POLICIES.filter(
    (policy) => policy.kind === "durable-db",
  )
    .map((policy) => policy.id)
    .sort();
  assert.deepEqual(
    [...DURABLE_RATE_LIMIT_POLICY_IDS].sort(),
    durableRegistryIds,
  );

  for (const id of DURABLE_RATE_LIMIT_POLICY_IDS) {
    const runtime = getRequestRateLimitPolicy(id);
    const registered = RATE_LIMIT_POLICIES.find((policy) => policy.id === id);
    assert.ok(registered && registered.kind === "durable-db", id);
    assert.deepEqual(runtime, {
      scope: registered.bucketScope,
      limit: registered.limit,
      windowMs: registered.windowMs,
    });
    assert.match(runtime.scope, /^[a-z][a-z0-9-]{0,63}$/);
    assert.ok(runtime.limit > 0);
    assert.ok(runtime.windowMs > 0);
  }
});

test("runtime v1 and export limits match their public contract", () => {
  assert.deepEqual(getRequestRateLimitPolicy("public-api-v1"), {
    scope: "api-v1",
    limit: V1_RATE_LIMIT_MAX,
    windowMs: V1_RATE_LIMIT_WINDOW_MS,
  });
  assert.deepEqual(getRequestRateLimitPolicy("public-dynamic-export"), {
    scope: "public-dynamic-export",
    limit: EXPORT_RATE_LIMIT_MAX,
    windowMs: EXPORT_RATE_LIMIT_WINDOW_MS,
  });
});
