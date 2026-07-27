import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADMIN_SESSION_COOKIE,
  adminReviewerName,
  buildAdminCookieHeaders,
  sanitizeReviewerName,
  verifyAdminUsername,
  verifySessionCookie,
} from "./session";

/** Run `fn` with a scoped env override, restoring the original value
 *  (including "was unset") afterward — even if `fn` throws. */
function withEnv<T>(key: string, value: string | undefined, fn: () => T): T {
  const had = Object.prototype.hasOwnProperty.call(process.env, key);
  const prev = process.env[key];
  try {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
    return fn();
  } finally {
    if (had) process.env[key] = prev;
    else delete process.env[key];
  }
}

// ─── verifyAdminUsername ────────────────────────────────────────────────

test("verifyAdminUsername fails closed when ADMIN_USERNAME is unset", () => {
  withEnv("ADMIN_USERNAME", undefined, () => {
    assert.equal(verifyAdminUsername("anything"), false);
    assert.equal(verifyAdminUsername(""), false);
    assert.equal(verifyAdminUsername(null), false);
    assert.equal(verifyAdminUsername(undefined), false);
  });
});

test("verifyAdminUsername accepts an exact match", () => {
  withEnv("ADMIN_USERNAME", "fernando", () => {
    assert.equal(verifyAdminUsername("fernando"), true);
  });
});

test("verifyAdminUsername trims surrounding whitespace on the submitted value", () => {
  withEnv("ADMIN_USERNAME", "fernando", () => {
    assert.equal(verifyAdminUsername("  fernando  "), true);
    assert.equal(verifyAdminUsername("\tfernando\n"), true);
  });
});

test("verifyAdminUsername rejects a mismatch", () => {
  withEnv("ADMIN_USERNAME", "fernando", () => {
    assert.equal(verifyAdminUsername("Fernando"), false); // case-sensitive
    assert.equal(verifyAdminUsername("fernand"), false); // prefix
    assert.equal(verifyAdminUsername("fernando "), true); // trimmed, still equal
    assert.equal(verifyAdminUsername("fernando2"), false);
    assert.equal(verifyAdminUsername(null), false);
    assert.equal(verifyAdminUsername(undefined), false);
  });
});

// ─── sanitizeReviewerName / adminReviewerName ───────────────────────────

test("sanitizeReviewerName keeps the allowed character set and trims", () => {
  assert.equal(sanitizeReviewerName("  Fernando Balino  ", "admin"), "Fernando Balino");
  assert.equal(sanitizeReviewerName("F.B_1-2", "admin"), "F.B_1-2");
});

test("sanitizeReviewerName strips disallowed characters", () => {
  assert.equal(
    sanitizeReviewerName("<script>alert(1)</script>", "admin"),
    "scriptalert1script",
  );
  assert.equal(sanitizeReviewerName("name@site.com", "admin"), "namesite.com");
});

test("sanitizeReviewerName caps at 80 characters", () => {
  const long = "a".repeat(120);
  const result = sanitizeReviewerName(long, "admin");
  assert.equal(result.length, 80);
  assert.equal(result, "a".repeat(80));
});

test("sanitizeReviewerName falls back when the sanitized result is empty", () => {
  assert.equal(sanitizeReviewerName(null, "admin"), "admin");
  assert.equal(sanitizeReviewerName(undefined, "admin"), "admin");
  assert.equal(sanitizeReviewerName("", "admin"), "admin");
  assert.equal(sanitizeReviewerName("   ", "admin"), "admin");
  // Only-disallowed-characters also collapses to empty -> fallback.
  assert.equal(sanitizeReviewerName("@@@###", "admin"), "admin");
});

test("adminReviewerName prefers ADMIN_DISPLAY_NAME over ADMIN_USERNAME", () => {
  withEnv("ADMIN_DISPLAY_NAME", "Reviewer Name", () => {
    withEnv("ADMIN_USERNAME", "fernando", () => {
      assert.equal(adminReviewerName(), "Reviewer Name");
    });
  });
});

test("adminReviewerName falls back to ADMIN_USERNAME when no display name is set", () => {
  withEnv("ADMIN_DISPLAY_NAME", undefined, () => {
    withEnv("ADMIN_USERNAME", "fernando", () => {
      assert.equal(adminReviewerName(), "fernando");
    });
  });
});

test("adminReviewerName falls back to the generic 'admin' when nothing is configured", () => {
  withEnv("ADMIN_DISPLAY_NAME", undefined, () => {
    withEnv("ADMIN_USERNAME", undefined, () => {
      assert.equal(adminReviewerName(), "admin");
    });
  });
});

// ─── verifySessionCookie ─────────────────────────────────────────────────
//
// Round-trip through the REAL production cookie minter
// (`buildAdminCookieHeaders`) rather than reimplementing the HMAC here, so
// these tests exercise the exact bytes a browser would receive.

function mintCookieValue(secret: string, reviewerName = "fernando"): string {
  return withEnv("ADMIN_SESSION_SECRET", secret, () => {
    const headers = buildAdminCookieHeaders(reviewerName);
    // headers[0] is always the ADMIN_SESSION_COOKIE Set-Cookie line: parse
    // out just the `<nonce>.<hmac>` value (URL-decoded, stripped of the
    // trailing cookie attributes).
    const [, raw] = headers[0];
    const eq = raw.indexOf("=");
    const semi = raw.indexOf(";");
    const encoded = raw.slice(eq + 1, semi === -1 ? undefined : semi);
    return decodeURIComponent(encoded);
  });
}

test("verifySessionCookie accepts a genuine cookie minted with the same secret", () => {
  const secret = "test-secret-abc123";
  const cookieValue = mintCookieValue(secret, "fernando");
  const result = verifySessionCookie(cookieValue, secret);
  assert.equal(result.valid, true);
  assert.equal(result.reviewerId, adminReviewerName());
});

test("verifySessionCookie rejects a tampered HMAC", () => {
  const secret = "test-secret-abc123";
  const cookieValue = mintCookieValue(secret);
  // Flip the last character of the HMAC half.
  const lastChar = cookieValue.at(-1)!;
  const flipped = lastChar === "0" ? "1" : "0";
  const tampered = cookieValue.slice(0, -1) + flipped;
  assert.notEqual(tampered, cookieValue);
  const result = verifySessionCookie(tampered, secret);
  assert.equal(result.valid, false);
  assert.equal(result.reviewerId, null);
});

test("verifySessionCookie rejects a tampered nonce (same principle as a forged cookie)", () => {
  const secret = "test-secret-abc123";
  const cookieValue = mintCookieValue(secret);
  const dot = cookieValue.indexOf(".");
  const nonce = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const forgedNonce = nonce.slice(0, -1) + (nonce.at(-1) === "a" ? "b" : "a");
  const result = verifySessionCookie(`${forgedNonce}.${mac}`, secret);
  assert.equal(result.valid, false);
  assert.equal(result.reviewerId, null);
});

test("verifySessionCookie invalidates outstanding cookies after a secret rotation", () => {
  // Documented behavior (session.ts header comment): "rotating the secret
  // invalidates every outstanding cookie." A cookie signed under the old
  // secret must fail verification against the new one — this is the
  // module's only expiry-like mechanism (there is no timestamp encoded in
  // the cookie itself; wall-clock expiry is delegated to the browser via
  // the Set-Cookie Max-Age attribute, which this pure function does not
  // see).
  const oldSecret = "old-secret-value";
  const newSecret = "new-secret-value";
  const cookieValue = mintCookieValue(oldSecret);
  const result = verifySessionCookie(cookieValue, newSecret);
  assert.equal(result.valid, false);
  assert.equal(result.reviewerId, null);
});

test("verifySessionCookie fails closed when the server has no secret configured", () => {
  const cookieValue = mintCookieValue("some-secret");
  assert.deepEqual(verifySessionCookie(cookieValue, undefined), {
    valid: false,
    reviewerId: null,
  });
  assert.deepEqual(verifySessionCookie(cookieValue, null), {
    valid: false,
    reviewerId: null,
  });
  assert.deepEqual(verifySessionCookie(cookieValue, ""), {
    valid: false,
    reviewerId: null,
  });
});

test("verifySessionCookie rejects missing cookie values", () => {
  const secret = "test-secret-abc123";
  assert.deepEqual(verifySessionCookie(undefined, secret), {
    valid: false,
    reviewerId: null,
  });
  assert.deepEqual(verifySessionCookie(null, secret), {
    valid: false,
    reviewerId: null,
  });
  assert.deepEqual(verifySessionCookie("", secret), {
    valid: false,
    reviewerId: null,
  });
});

test("verifySessionCookie rejects malformed cookie shapes", () => {
  const secret = "test-secret-abc123";
  for (const malformed of [
    "no-dot-at-all",
    ".leading-dot-empty-nonce",
    "trailing-dot-empty-mac.",
    "..",
    ".",
  ]) {
    const result = verifySessionCookie(malformed, secret);
    assert.equal(result.valid, false, `should reject: ${JSON.stringify(malformed)}`);
    assert.equal(result.reviewerId, null);
  }
});

test("verifySessionCookie is deterministic — same inputs, same result, no throw", () => {
  const secret = "test-secret-abc123";
  const cookieValue = mintCookieValue(secret);
  const first = verifySessionCookie(cookieValue, secret);
  const second = verifySessionCookie(cookieValue, secret);
  assert.deepEqual(first, second);
});

test("ADMIN_SESSION_COOKIE name is stable (audit-log / cookie-clearing contract)", () => {
  assert.equal(ADMIN_SESSION_COOKIE, "civica_admin_session");
});
