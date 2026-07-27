import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type {
  DurableRateLimitOptions,
  DurableRateLimitResult,
} from "@/lib/api/rate-limit";
import { rateLimitResponse } from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { getRateLimitSubject } from "@/lib/api/rate-limit-subject";
import {
  ADMIN_LOGIN_RATE_LIMIT,
  checkAdminLoginRateLimit,
  type AdminLoginRateLimitDependencies,
} from "./login-rate-limit";

const TEST_SECRET = "s".repeat(32);
const SUBJECT = "a".repeat(64);
const ALLOWED: DurableRateLimitResult = {
  status: "allowed",
  allowed: true,
  remaining: 4,
  retryAfterMs: 0,
};

function request(headers: HeadersInit = {}): Request {
  return new Request("https://civicaatlas.org/api/admin/session", { headers });
}

function testSubject(candidate: Request, scope: string): Promise<string> {
  return getRateLimitSubject(candidate, scope, {
    secret: TEST_SECRET,
    environment: "test",
  });
}

test("admin login uses the reviewed runtime policy without local constants", () => {
  assert.deepEqual(
    ADMIN_LOGIN_RATE_LIMIT,
    getRequestRateLimitPolicy("admin-credential-bootstrap"),
  );
  assert.deepEqual(ADMIN_LOGIN_RATE_LIMIT, {
    scope: "admin-credential-bootstrap",
    limit: 5,
    windowMs: 15 * 60_000,
  });
});

test("admin login delegates an opaque shared HMAC subject and never a raw IP", async () => {
  const ip = "203.0.113.42";
  let received: DurableRateLimitOptions | undefined;
  let signedScope = "";
  const result = await checkAdminLoginRateLimit(
    request({ "x-forwarded-for": ip }),
    {
      async subject(candidate, scope) {
        signedScope = scope;
        return testSubject(candidate, scope);
      },
      async check(options) {
        received = options;
        return ALLOWED;
      },
    },
  );

  assert.deepEqual(result, ALLOWED);
  assert.equal(signedScope, ADMIN_LOGIN_RATE_LIMIT.scope);
  assert.deepEqual(received, {
    ...ADMIN_LOGIN_RATE_LIMIT,
    subjectHash: received?.subjectHash,
  });
  assert.match(received?.subjectHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(received).includes(ip), false);
});

test("proxy chains are rejected into the same unknown bucket", async () => {
  async function capturedSubject(
    candidate: Request,
  ): Promise<string | undefined> {
    let subjectHash: string | undefined;
    await checkAdminLoginRateLimit(candidate, {
      subject: testSubject,
      async check(options) {
        subjectHash = options.subjectHash;
        return ALLOWED;
      },
    });
    return subjectHash;
  }

  const chained = await capturedSubject(
    request({ "x-forwarded-for": "192.0.2.1, 198.51.100.20" }),
  );
  const missing = await capturedSubject(request());
  const direct = await capturedSubject(
    request({ "x-forwarded-for": "198.51.100.20" }),
  );

  assert.match(chained ?? "", /^[a-f0-9]{64}$/);
  assert.equal(chained, missing);
  assert.notEqual(chained, direct);
});

test("admin login preserves limited versus store-unavailable decisions", async () => {
  const limited: DurableRateLimitResult = {
    status: "limited",
    allowed: false,
    remaining: 0,
    retryAfterMs: 42_000,
  };
  const unavailable: DurableRateLimitResult = {
    status: "store_unavailable",
    allowed: false,
    remaining: 0,
    retryAfterMs: null,
  };

  for (const expected of [limited, unavailable]) {
    const dependencies: AdminLoginRateLimitDependencies = {
      subject: async () => SUBJECT,
      check: async () => expected,
    };
    assert.deepEqual(
      await checkAdminLoginRateLimit(request(), dependencies),
      expected,
    );
  }

  assert.equal(rateLimitResponse(limited, ADMIN_LOGIN_RATE_LIMIT).status, 429);
  assert.equal(
    rateLimitResponse(unavailable, ADMIN_LOGIN_RATE_LIMIT).status,
    503,
  );
});

test("admin login sends the exact shared policy on every attempt", async () => {
  let count = 0;
  const dependencies: AdminLoginRateLimitDependencies = {
    subject: async () => SUBJECT,
    async check(options) {
      assert.deepEqual(options, {
        ...ADMIN_LOGIN_RATE_LIMIT,
        subjectHash: SUBJECT,
      });
      count += 1;
      if (count > options.limit) {
        return {
          status: "limited",
          allowed: false,
          remaining: 0,
          retryAfterMs: options.windowMs,
        };
      }
      return {
        status: "allowed",
        allowed: true,
        remaining: options.limit - count,
        retryAfterMs: 0,
      };
    },
  };

  const attempts = await Promise.all(
    Array.from({ length: 6 }, () =>
      checkAdminLoginRateLimit(request(), dependencies),
    ),
  );
  assert.deepEqual(
    attempts.map(({ status }) => status),
    ["allowed", "allowed", "allowed", "allowed", "allowed", "limited"],
  );
});

test("password route throttles before parsing or password verification and uses the shared response", () => {
  const source = readFileSync(
    new URL("../../app/api/admin/session/route.ts", import.meta.url),
    "utf8",
  );
  const throttle = source.indexOf("await checkAdminLoginRateLimit(request)");
  const response = source.indexOf("rateLimitResponse(rateLimit");
  const parseBody = source.indexOf("await parseBoundedRequestBody");
  const verifyPassword = source.indexOf("await verifyPassword(");

  assert.ok(throttle >= 0, "route must invoke the admin login limiter");
  assert.ok(response > throttle, "route must use the shared 429/503 response");
  assert.ok(parseBody > throttle, "rate limit must precede body parsing");
  assert.ok(verifyPassword > throttle, "rate limit must precede password KDF");
  assert.match(source, /rateLimit\.status !== "allowed"/);
  assert.doesNotMatch(source, /adminLoginRateLimitKey|createHash/);
});
