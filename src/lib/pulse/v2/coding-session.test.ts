import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_CODING_SESSION_COOKIE,
  buildPulseCodingClearCookieHeaders,
  buildPulseCodingCookieHeaders,
} from "./coding-session";

test("coding session uses a distinct narrow HttpOnly cookie", () => {
  const previous = process.env.PULSE_CODING_SESSION_SECRET;
  process.env.PULSE_CODING_SESSION_SECRET = "test-secret-that-is-long-enough";
  try {
    const headers = buildPulseCodingCookieHeaders(
      "11111111-1111-4111-8111-111111111111",
      null,
    );
    assert.equal(headers.length, 1);
    assert.match(headers[0][1], new RegExp(`^${PULSE_CODING_SESSION_COOKIE}=`));
    assert.match(headers[0][1], /Path=\/admin\/pulse-coding/);
    assert.match(headers[0][1], /HttpOnly/);
    assert.match(headers[0][1], /SameSite=Lax/);
    assert.doesNotMatch(headers[0][1], /test-secret/);
  } finally {
    if (previous === undefined) delete process.env.PULSE_CODING_SESSION_SECRET;
    else process.env.PULSE_CODING_SESSION_SECRET = previous;
  }
});

test("coding sign-out clears only the coding cookie path", () => {
  const [header] = buildPulseCodingClearCookieHeaders();
  assert.match(header[1], /Max-Age=0/);
  assert.match(header[1], /Path=\/admin\/pulse-coding/);
});
