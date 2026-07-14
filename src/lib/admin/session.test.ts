import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  ADMIN_REVIEWER_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  ADMIN_SESSION_VERSION,
  adminReviewerName,
  isAdminSessionConfigured,
  mintAdminSessionCookie,
  sanitizeReviewerName,
  verifyAdminUsername,
  verifySessionCookie,
} from "./session";

const FIXED_NOW_MS = Date.UTC(2026, 6, 14, 12, 0, 0);
const TEST_SECRET = "test-secret-abc123";

/** Scope an environment override and restore even an originally-unset key. */
function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const previous = process.env[key];
  try {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    return fn();
  } finally {
    if (had) process.env[key] = previous;
    else delete process.env[key];
  }
}

function withAdminEnv<T>(
  fn: () => T,
  options: {
    username?: string | undefined;
    displayName?: string | undefined;
    secret?: string | undefined;
  } = {},
): T {
  const username = Object.hasOwn(options, "username")
    ? options.username
    : "fernando";
  const displayName = options.displayName;
  const secret = Object.hasOwn(options, "secret")
    ? options.secret
    : TEST_SECRET;
  return withEnv("ADMIN_USERNAME", username, () =>
    withEnv("ADMIN_DISPLAY_NAME", displayName, () =>
      withEnv("ADMIN_SESSION_SECRET", secret, fn),
    ),
  );
}

function cookieValueFromHeaders(headers: Array<[string, string]>): string {
  const [, raw] = headers[0];
  const equals = raw.indexOf("=");
  const semicolon = raw.indexOf(";");
  return decodeURIComponent(raw.slice(equals + 1, semicolon));
}

function mintCookieValue(
  nowMs = FIXED_NOW_MS,
  options?: Parameters<typeof withAdminEnv>[1],
): string {
  return withAdminEnv(
    () => cookieValueFromHeaders(mintAdminSessionCookie(nowMs).headers),
    options,
  );
}

function verifyAs(
  cookieValue: string | null | undefined,
  secret: string | null | undefined = TEST_SECRET,
  nowMs = FIXED_NOW_MS,
  options?: Omit<Parameters<typeof withAdminEnv>[1], "secret">,
) {
  return withAdminEnv(() => verifySessionCookie(cookieValue, secret, nowMs), {
    ...options,
    secret: secret ?? undefined,
  });
}

function decodePayload(cookieValue: string): Record<string, unknown> {
  const [, encodedPayload] = cookieValue.split(".");
  return JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

function signTestPayload(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signedValue = `v1.${encodedPayload}`;
  const mac = createHmac("sha256", secret).update(signedValue).digest("hex");
  return `${signedValue}.${mac}`;
}

test("verifyAdminUsername fails closed when ADMIN_USERNAME is unset", () => {
  withEnv("ADMIN_USERNAME", undefined, () => {
    assert.equal(verifyAdminUsername("anything"), false);
    assert.equal(verifyAdminUsername(""), false);
    assert.equal(verifyAdminUsername(null), false);
    assert.equal(verifyAdminUsername(undefined), false);
  });
});

test("verifyAdminUsername accepts only the trimmed exact configured value", () => {
  withEnv("ADMIN_USERNAME", "fernando", () => {
    assert.equal(verifyAdminUsername("fernando"), true);
    assert.equal(verifyAdminUsername("  fernando\n"), true);
    assert.equal(verifyAdminUsername("Fernando"), false);
    assert.equal(verifyAdminUsername("fernand"), false);
    assert.equal(verifyAdminUsername("fernando2"), false);
  });
});

test("sanitizeReviewerName bounds and filters audit identities", () => {
  assert.equal(
    sanitizeReviewerName("  Fernando Balino  ", "fallback"),
    "Fernando Balino",
  );
  assert.equal(
    sanitizeReviewerName("<script>alert(1)</script>", "fallback"),
    "scriptalert1script",
  );
  assert.equal(sanitizeReviewerName("a".repeat(120), "fallback").length, 80);
  assert.equal(sanitizeReviewerName("@@@###", "fallback"), "fallback");
});

test("adminReviewerName prefers a valid display name then the username", () => {
  withAdminEnv(() => assert.equal(adminReviewerName(), "Fernando Balino"), {
    displayName: "Fernando Balino",
  });
  withAdminEnv(() => assert.equal(adminReviewerName(), "fernando"));
  withAdminEnv(() => assert.equal(adminReviewerName(), "fernando"), {
    displayName: "@@@",
  });
});

test("production identity fails closed with no hardcoded default", () => {
  withAdminEnv(
    () => {
      assert.equal(adminReviewerName(), null);
      assert.equal(isAdminSessionConfigured(), false);
      assert.throws(
        () => mintAdminSessionCookie(FIXED_NOW_MS),
        /identity or signing secret is not configured/,
      );
    },
    { username: undefined, displayName: undefined },
  );
});

test("session configuration requires both a signing secret and identity", () => {
  withAdminEnv(() => assert.equal(isAdminSessionConfigured(), true));
  withAdminEnv(() => assert.equal(isAdminSessionConfigured(), false), {
    secret: undefined,
  });
  withAdminEnv(() => assert.equal(isAdminSessionConfigured(), false), {
    username: undefined,
  });
});

test("a genuine v1 session verifies its identity, times, and random ID", () => {
  const cookieValue = mintCookieValue();
  assert.equal(cookieValue.split(".")[0], "v1");

  const result = verifyAs(cookieValue);
  assert.equal(result.valid, true);
  assert.ok(result.session);
  assert.equal(result.session.version, ADMIN_SESSION_VERSION);
  assert.equal(result.session.reviewerId, "fernando");
  assert.equal(result.session.issuedAt, FIXED_NOW_MS / 1000);
  assert.equal(
    result.session.expiresAt,
    FIXED_NOW_MS / 1000 + ADMIN_SESSION_TTL_SECONDS,
  );
  assert.match(result.session.sessionId, /^[0-9a-f]{36}$/);
});

test("each newly minted session receives a unique session ID", () => {
  const first = decodePayload(mintCookieValue()).sessionId;
  const second = decodePayload(mintCookieValue()).sessionId;
  assert.equal(typeof first, "string");
  assert.equal(typeof second, "string");
  assert.notEqual(first, second);
});

test("verification rejects tampered payloads and signatures", () => {
  const cookieValue = mintCookieValue();
  const [format, encoded, mac] = cookieValue.split(".");
  const changedPayload = `${format}.${encoded.slice(0, -1)}${encoded.at(-1) === "a" ? "b" : "a"}.${mac}`;
  const changedMac = `${format}.${encoded}.${mac.slice(0, -1)}${mac.at(-1) === "0" ? "1" : "0"}`;

  assert.deepEqual(verifyAs(changedPayload), { valid: false, session: null });
  assert.deepEqual(verifyAs(changedMac), { valid: false, session: null });
});

test("verification rejects a cookie after signing-secret rotation", () => {
  const cookieValue = mintCookieValue();
  assert.deepEqual(verifyAs(cookieValue, "rotated-secret"), {
    valid: false,
    session: null,
  });
});

test("verification binds the signed reviewer to current server identity", () => {
  const cookieValue = mintCookieValue();
  assert.deepEqual(
    verifyAs(cookieValue, TEST_SECRET, FIXED_NOW_MS, { username: "other" }),
    { valid: false, session: null },
  );
  assert.deepEqual(
    verifyAs(cookieValue, TEST_SECRET, FIXED_NOW_MS, {
      username: undefined,
      displayName: undefined,
    }),
    { valid: false, session: null },
  );
});

test("verification enforces server-side expiry independent of Max-Age", () => {
  const cookieValue = mintCookieValue();
  const justBeforeExpiry = FIXED_NOW_MS + ADMIN_SESSION_TTL_SECONDS * 1000 - 1;
  const atExpiry = FIXED_NOW_MS + ADMIN_SESSION_TTL_SECONDS * 1000;

  assert.equal(
    verifyAs(cookieValue, TEST_SECRET, justBeforeExpiry).valid,
    true,
  );
  assert.deepEqual(verifyAs(cookieValue, TEST_SECRET, atExpiry), {
    valid: false,
    session: null,
  });
});

test("verification rejects issued-at timestamps beyond clock-skew allowance", () => {
  const cookieValue = mintCookieValue(FIXED_NOW_MS + 61_000);
  assert.deepEqual(verifyAs(cookieValue), { valid: false, session: null });

  const withinSkew = mintCookieValue(FIXED_NOW_MS + 60_000);
  assert.equal(verifyAs(withinSkew).valid, true);
});

test("verification strictly validates the signed payload schema", () => {
  const validPayload = decodePayload(mintCookieValue());
  const malformedPayloads: Array<Record<string, unknown>> = [
    { ...validPayload, version: "civica-admin-session/v0" },
    { ...validPayload, expiresAt: Number(validPayload.expiresAt) + 1 },
    { ...validPayload, issuedAt: Number.MAX_VALUE },
    { ...validPayload, sessionId: "predictable" },
    { ...validPayload, extra: true },
  ];

  for (const payload of malformedPayloads) {
    assert.deepEqual(verifyAs(signTestPayload(payload)), {
      valid: false,
      session: null,
    });
  }
});

test("session time inputs fail closed outside JavaScript's safe range", () => {
  const cookieValue = mintCookieValue();
  assert.deepEqual(verifyAs(cookieValue, TEST_SECRET, Number.MAX_VALUE), {
    valid: false,
    session: null,
  });
  withAdminEnv(() =>
    assert.throws(
      () => mintAdminSessionCookie(Number.MAX_VALUE),
      /issuance time is outside the safe range/,
    ),
  );
});

test("verification rejects missing, legacy, and malformed cookie envelopes", () => {
  for (const malformed of [
    undefined,
    null,
    "",
    "legacy-nonce.legacy-mac",
    "v1.payload",
    "v2.payload.mac",
    "v1.payload.not-a-valid-mac",
    "v1.." + "0".repeat(64),
    "v1.payload." + "0".repeat(64) + ".extra",
  ]) {
    assert.deepEqual(verifyAs(malformed), { valid: false, session: null });
  }
});

test("verification fails closed when no signing secret is supplied", () => {
  const cookieValue = mintCookieValue();
  assert.deepEqual(
    withAdminEnv(() =>
      verifySessionCookie(cookieValue, undefined, FIXED_NOW_MS),
    ),
    { valid: false, session: null },
  );
  for (const secret of [null, ""]) {
    assert.deepEqual(verifyAs(cookieValue, secret), {
      valid: false,
      session: null,
    });
  }
});

test("issued cookies align browser Max-Age and clear legacy reviewer state", () => {
  const headers = withAdminEnv(
    () => mintAdminSessionCookie(FIXED_NOW_MS).headers,
  );
  assert.match(
    headers[0][1],
    new RegExp(`Max-Age=${ADMIN_SESSION_TTL_SECONDS}`),
  );
  assert.match(headers[0][1], /HttpOnly/);
  assert.match(headers[0][1], /SameSite=Lax/);
  assert.match(headers[1][1], new RegExp(`^${ADMIN_REVIEWER_COOKIE}=;`));
  assert.match(headers[1][1], /Max-Age=0/);
});

test("ADMIN_SESSION_COOKIE name remains stable", () => {
  assert.equal(ADMIN_SESSION_COOKIE, "civica_admin_session");
});
