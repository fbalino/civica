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

/** Read + validate the admin session cookie. Returns null when the
 *  cookie is missing, invalid, or the server isn't configured with
 *  ADMIN_SESSION_SECRET. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const cookieJar = await cookies();
  const session = cookieJar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  // Cookie is `<nonce>.<hmac>`. Recompute the expected HMAC from the
  // nonce + server secret and constant-time compare.
  const dot = session.indexOf(".");
  if (dot <= 0 || dot === session.length - 1) return null;
  const nonce = session.slice(0, dot);
  const presentedMac = session.slice(dot + 1);
  const expectedMac = signNonce(secret, nonce);
  if (!safeEqual(presentedMac, expectedMac)) return null;

  const reviewerId =
    cookieJar.get(ADMIN_REVIEWER_COOKIE)?.value?.trim() ||
    adminReviewerName();
  return { reviewerId };
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
  const common = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
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
  const common = `Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    ["Set-Cookie", `${ADMIN_SESSION_COOKIE}=; ${common}${secure}`],
    ["Set-Cookie", `${ADMIN_REVIEWER_COOKIE}=; ${common}${secure}`],
  ];
}
