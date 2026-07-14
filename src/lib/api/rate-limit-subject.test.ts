import assert from "node:assert/strict";
import test from "node:test";

import {
  getRateLimitSubject,
  RateLimitConfigurationError,
} from "./rate-limit-subject";

const SECRET = "s".repeat(32);

function request(ip?: string): Request {
  return new Request("https://civicaatlas.org/api/test", {
    headers: ip ? { "x-forwarded-for": ip } : undefined,
  });
}

test("subjects are deterministic, opaque, and separated by scope", async () => {
  const ip = "203.0.113.42";
  const first = await getRateLimitSubject(request(ip), "public-api", {
    secret: SECRET,
    environment: "test",
  });
  const same = await getRateLimitSubject(request(ip), "public-api", {
    secret: SECRET,
    environment: "test",
  });
  const otherScope = await getRateLimitSubject(request(ip), "contact", {
    secret: SECRET,
    environment: "test",
  });

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, same);
  assert.notEqual(first, otherScope);
  assert.equal(first.includes(ip), false);
});

test("requests without a trusted identity share one unknown subject", async () => {
  const first = await getRateLimitSubject(request(), "public-api", {
    secret: SECRET,
    environment: "test",
  });
  const second = await getRateLimitSubject(request(), "public-api", {
    secret: SECRET,
    environment: "test",
  });
  assert.equal(first, second);
});

test("production fails closed when its independent key is missing or weak", async () => {
  await assert.rejects(
    getRateLimitSubject(request("203.0.113.42"), "public-api", {
      secret: "",
      environment: "production",
    }),
    RateLimitConfigurationError,
  );
  await assert.rejects(
    getRateLimitSubject(request("203.0.113.42"), "public-api", {
      secret: "too-short",
      environment: "production",
    }),
    /at least 32 bytes/,
  );
});

test("scope identifiers are bounded before signing", async () => {
  await assert.rejects(
    getRateLimitSubject(request("203.0.113.42"), "Not a scope", {
      secret: SECRET,
      environment: "test",
    }),
    /Invalid rate-limit scope/,
  );
});
