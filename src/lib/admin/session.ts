/**
 * Phase 5.7 — admin session helpers.
 *
 * Browser-friendly auth for the /admin/* routes. The ADMIN_API_KEY
 * env var is the single shared secret; the user supplies it once via
 * the sign-in form, and we set an HttpOnly cookie that proves the
 * operator knew the key — WITHOUT storing the raw key itself.
 *
 * Cookie format (2026-06 security hardening): `<nonce>.<tokenHash>`,
 * where `nonce` is a random per-session value and
 * `tokenHash = sha256(ADMIN_API_KEY + ":" + nonce)`. Validation
 * recomputes the hash from the cookie's nonce plus the server's
 * ADMIN_API_KEY and constant-time compares. Only a sign-in that knew
 * ADMIN_API_KEY could have produced a matching pair, so a leaked
 * cookie no longer exposes the master secret (and rotating the env
 * var invalidates every outstanding cookie). The /api/admin/* Bearer
 * header path is unchanged — operators with the raw key still get the
 * UI for free; they just exchange it for an opaque session cookie.
 *
 * The reviewer's display name is captured at sign-in time and stored
 * in a sibling `civica_admin_reviewer` cookie (also HttpOnly). It's
 * surfaced as the `reviewerId` on every audit log row.
 */

import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "civica_admin_session";
export const ADMIN_REVIEWER_COOKIE = "civica_admin_reviewer";
const SESSION_TTL_DAYS = 7;

export interface AdminSession {
  reviewerId: string;
}

/** Derive the opaque session token for a given nonce. The raw
 *  ADMIN_API_KEY never leaves the server — only this one-way hash of
 *  `key:nonce` is ever stored in the cookie. */
function deriveSessionToken(adminKey: string, nonce: string): string {
  return createHash("sha256").update(`${adminKey}:${nonce}`).digest("hex");
}

/** Constant-time string compare that tolerates length mismatches
 *  (timingSafeEqual throws when buffer lengths differ). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Read + validate the admin session cookie. Returns null when the
 *  cookie is missing, invalid, or the server isn't configured with
 *  ADMIN_API_KEY. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return null;

  const cookieJar = await cookies();
  const session = cookieJar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;

  // Cookie is `<nonce>.<tokenHash>`. Recompute the expected hash from
  // the nonce + server key and constant-time compare.
  const dot = session.indexOf(".");
  if (dot <= 0 || dot === session.length - 1) return null;
  const nonce = session.slice(0, dot);
  const presentedHash = session.slice(dot + 1);
  const expectedHash = deriveSessionToken(expected, nonce);
  if (!safeEqual(presentedHash, expectedHash)) return null;

  const reviewerId =
    cookieJar.get(ADMIN_REVIEWER_COOKIE)?.value?.trim() ||
    "anonymous-reviewer";
  return { reviewerId };
}

/** Set both cookies on a Response. Mints a fresh per-session nonce and
 *  stores `<nonce>.<tokenHash>` — never the raw ADMIN_API_KEY. */
export function buildAdminCookieHeaders(
  reviewerName: string
): Array<[string, string]> {
  const adminKey = process.env.ADMIN_API_KEY ?? "";
  const nonce = randomBytes(18).toString("hex");
  const sessionValue = `${nonce}.${deriveSessionToken(adminKey, nonce)}`;
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
