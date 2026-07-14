import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ADMIN_LOGIN_RATE_LIMIT,
  adminLoginRateLimitKey,
  checkAdminLoginRateLimit,
  type AdminLoginRateLimitChecker,
} from "./login-rate-limit";

test("admin login keys hash the trusted request IP before shared storage", () => {
  const ip = "203.0.113.42";
  const first = adminLoginRateLimitKey(
    new Request("https://civicaatlas.org/api/admin/session", {
      headers: { "x-real-ip": ip },
    }),
  );
  const second = adminLoginRateLimitKey(
    new Request("https://civicaatlas.org/api/admin/session", {
      headers: { "x-real-ip": ip },
    }),
  );
  const other = adminLoginRateLimitKey(
    new Request("https://civicaatlas.org/api/admin/session", {
      headers: { "x-real-ip": "203.0.113.43" },
    }),
  );

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.equal(first.includes(ip), false);
});

test("admin login key uses the shared trusted proxy resolution", () => {
  const realIp = new Request("https://civicaatlas.org", {
    headers: {
      "x-real-ip": "198.51.100.10",
      "x-forwarded-for": "192.0.2.1, 198.51.100.20",
    },
  });
  const forwarded = new Request("https://civicaatlas.org", {
    headers: { "x-forwarded-for": "192.0.2.1, 198.51.100.20" },
  });
  const directRightmost = new Request("https://civicaatlas.org", {
    headers: { "x-real-ip": "198.51.100.20" },
  });

  assert.notEqual(
    adminLoginRateLimitKey(realIp),
    adminLoginRateLimitKey(forwarded),
  );
  assert.equal(
    adminLoginRateLimitKey(forwarded),
    adminLoginRateLimitKey(directRightmost),
  );
});

test("admin login delegates the exact policy to the durable limiter", async () => {
  let received: Parameters<AdminLoginRateLimitChecker>[0] | undefined;
  const checker: AdminLoginRateLimitChecker = async (options) => {
    received = options;
    return { allowed: false, remaining: 0, retryAfterMs: 42_000 };
  };
  const request = new Request("https://civicaatlas.org/api/admin/session", {
    headers: { "x-real-ip": "203.0.113.42" },
  });

  const result = await checkAdminLoginRateLimit(request, checker);

  assert.deepEqual(result, {
    allowed: false,
    remaining: 0,
    retryAfterMs: 42_000,
  });
  assert.deepEqual(received, {
    ...ADMIN_LOGIN_RATE_LIMIT,
    key: adminLoginRateLimitKey(request),
  });
});

test("password route throttles before parsing or password verification", () => {
  const source = readFileSync(
    new URL("../../app/api/admin/session/route.ts", import.meta.url),
    "utf8",
  );
  const throttle = source.indexOf("await checkAdminLoginRateLimit(request)");
  const parseForm = source.indexOf("await request.formData()");
  const verifyPassword = source.indexOf("await verifyPassword(");

  assert.ok(throttle >= 0, "route must invoke the admin login limiter");
  assert.ok(parseForm > throttle, "rate limit must precede form parsing");
  assert.ok(verifyPassword > throttle, "rate limit must precede password KDF");
  assert.match(source, /status:\s*429/);
  assert.match(source, /"Retry-After"/);
  assert.match(source, /"X-RateLimit-Remaining": "0"/);
});
