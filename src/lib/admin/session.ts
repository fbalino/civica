/**
 * Admin session helpers.
 *
 * Browser-friendly auth for the /admin/* routes. Access is a single
 * owner account: a username (`ADMIN_USERNAME`) plus a password whose
 * salted scrypt hash lives in `ADMIN_PASSWORD_HASH` (see
 * `src/lib/admin/password.ts`). The operator signs in once with
 * username + password; on success we set an HttpOnly cookie that proves
 * the browser completed a valid sign-in — WITHOUT storing the password
 * or its hash in the cookie.
 *
 * Cookie format: `<nonce>.<hmac>`, where `nonce` is a random per-session
 * value and `hmac = HMAC-SHA256(ADMIN_SESSION_SECRET, nonce)`. The
 * signing key is a dedicated `ADMIN_SESSION_SECRET` — deliberately
 * separate from the password hash so the cookie's validity doesn't hinge
 * on the credential, and rotating the secret invalidates every
 * outstanding cookie. Validation recomputes the HMAC from the cookie's
 * nonce plus the server secret and constant-time compares, so a leaked
 * cookie exposes neither the secret nor the password.
 *
 * There is NO bearer/API-key path anymore — the /admin/* surface and its
 * mutation routes gate on this session cookie only. The reviewer display
 * name on every audit-log row is the configured `ADMIN_USERNAME` (or an
 * optional `ADMIN_DISPLAY_NAME` override), captured at sign-in time and
 * stored in a sibling HttpOnly `civica_admin_reviewer` cookie.
 */

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "civica_admin_session";
export const ADMIN_REVIEWER_COOKIE = "civica_admin_reviewer";
const SESSION_TTL_DAYS = 7;

export interface AdminSession {
  reviewerId: string;
}

/** Sign a nonce with the session secret. The secret never leaves the
 *  server — only this keyed HMAC of the nonce is stored in the cookie. */
function signNonce(secret: string, nonce: string): string {
  return createHmac("sha256", secret).update(nonce).digest("hex");
}

/** Constant-time string compare that tolerates length mismatches
 *  (timingSafeEqual throws when buffer lengths differ). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * The reviewer display name for audit-log rows. Prefers the optional
 * `ADMIN_DISPLAY_NAME`, falling back to `ADMIN_USERNAME`, then to a
 * generic "admin". Sanitised to the audit-safe shape so an odd env value
 * can't land unescaped in a log row.
 */
export function adminReviewerName(): string {
  return sanitizeReviewerName(
    process.env.ADMIN_DISPLAY_NAME || process.env.ADMIN_USERNAME,
    "admin",
  );
}

/**
 * Constant-time verify a submitted username against `ADMIN_USERNAME`.
 * Returns false when `ADMIN_USERNAME` is unset (fail closed). The
 * password half is checked separately via `verifyPassword`
 * (`src/lib/admin/password.ts`); a sign-in requires BOTH.
 */
export function verifyAdminUsername(username: string | null | undefined): boolean {
  const expected = process.env.ADMIN_USERNAME;
  if (!expected) return false;
  return safeEqual((username ?? "").trim(), expected);
}

/**
 * Sanitise an operator-supplied reviewer name to a bounded, audit-safe
 * shape: keep only `[a-zA-Z0-9 _.\-]`, trim, and cap at 80 chars. Returns
 * `fallback` when the result is empty.
 */
export function sanitizeReviewerName(
  raw: string | null | undefined,
  fallback: string,
): string {
  return (
    (raw ?? "").replace(/[^a-zA-Z0-9 _.\-]/g, "").trim().slice(0, 80) ||
    fallback
  );
}

/**
 * Result of verifying a raw session-cookie value against a server secret.
 * `valid: false` covers every rejection path (missing, malformed, or a
 * signature that doesn't match) — callers only need `reviewerId` when
 * `valid` is `true`.
 */
export interface SessionCookieVerification {
  valid: boolean;
  reviewerId: string | null;
}

/**
 * Pure cookie-parse + HMAC-verify logic, extracted from `getAdminSession()`
 * so it's unit-testable without Next.js request context (`cookies()` only
 * works inside a request). Given the raw `<nonce>.<hmac>` cookie value and
 * the server secret, recomputes the expected HMAC and constant-time
 * compares it against the presented one.
 *
 * Behavior-preserving extraction (QA-002): every branch below is byte-for-
 * byte the same logic `getAdminSession()` used to run inline. On success,
 * the reviewer identity is derived the same way as before — from the
 * environment via `adminReviewerName()`, NEVER from the unsigned
 * `civica_admin_reviewer` cookie, which a client could edit to forge
 * audit-row identity (PLT-027).
 */
export function verifySessionCookie(
  cookieValue: string | null | undefined,
  secret: string | null | undefined,
): SessionCookieVerification {
  if (!secret) return { valid: false, reviewerId: null };
  if (!cookieValue) return { valid: false, reviewerId: null };

  // Cookie is `<nonce>.<hmac>`. Recompute the expected HMAC from the
  // nonce + server secret and constant-time compare.
  const dot = cookieValue.indexOf(".");
  if (dot <= 0 || dot === cookieValue.length - 1) {
    return { valid: false, reviewerId: null };
  }
  const nonce = cookieValue.slice(0, dot);
  const presentedMac = cookieValue.slice(dot + 1);
  const expectedMac = signNonce(secret, nonce);
  if (!safeEqual(presentedMac, expectedMac)) {
    return { valid: false, reviewerId: null };
  }

  return { valid: true, reviewerId: adminReviewerName() };
}

/** Read + validate the admin session cookie. Returns null when the
 *  cookie is missing, invalid, or the server isn't configured with
 *  ADMIN_SESSION_SECRET. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const cookieJar = await cookies();
  const session = cookieJar.get(ADMIN_SESSION_COOKIE)?.value;

  const result = verifySessionCookie(session, secret);
  if (!result.valid || !result.reviewerId) return null;

  return { reviewerId: result.reviewerId };
}

/** Set both cookies on a Response. Mints a fresh per-session nonce and
 *  stores `<nonce>.<hmac>` — never any secret material. */
export function buildAdminCookieHeaders(
  reviewerName: string,
): Array<[string, string]> {
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  const nonce = randomBytes(18).toString("hex");
  const sessionValue = `${nonce}.${signNonce(secret, nonce)}`;
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  // SameSite=Lax, not Strict: the Google sign-in return (start → Google →
  // callback → this cookie) is a cross-site-initiated top-level GET
  // redirect chain, and Strict cookies aren't sent on the request
  // immediately following it — the browser would land back on
  // /admin/sign-in even though the cookie was set correctly. Lax still
  // blocks the cookie on cross-site POST/PUT/DELETE (the actual CSRF
  // vector); every mutating admin route is POST/PUT/DELETE already.
  const common = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  // Secure flag in production only (cookies-without-secure are blocked
  // on HTTPS but useful for local dev over http://localhost).
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    [
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionValue)}; ${common}${secure}`,
    ],
    [
      "Set-Cookie",
      `${ADMIN_REVIEWER_COOKIE}=${encodeURIComponent(reviewerName)}; ${common}${secure}`,
    ],
  ];
}

export function buildAdminClearCookieHeaders(): Array<[string, string]> {
  const common = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    ["Set-Cookie", `${ADMIN_SESSION_COOKIE}=; ${common}${secure}`],
    ["Set-Cookie", `${ADMIN_REVIEWER_COOKIE}=; ${common}${secure}`],
  ];
}
