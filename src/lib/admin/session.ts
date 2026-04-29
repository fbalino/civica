/**
 * Phase 5.7 — admin session helpers.
 *
 * Browser-friendly auth for the /admin/* routes. The ADMIN_API_KEY
 * env var is the single shared secret; the user supplies it once via
 * the sign-in form, we set an HttpOnly cookie containing the same
 * value, and subsequent requests check it.
 *
 * Same key as the existing /api/admin/* Bearer auth — operators with
 * the API key get the UI for free.
 *
 * The reviewer's display name is captured at sign-in time and stored
 * in a sibling `civica_admin_reviewer` cookie (also HttpOnly). It's
 * surfaced as the `reviewerId` on every audit log row.
 */

import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "civica_admin_session";
export const ADMIN_REVIEWER_COOKIE = "civica_admin_reviewer";
const SESSION_TTL_DAYS = 7;

export interface AdminSession {
  reviewerId: string;
}

/** Read + validate the admin session cookie. Returns null when the
 *  cookie is missing, invalid, or the server isn't configured with
 *  ADMIN_API_KEY. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return null;

  const cookieJar = await cookies();
  const session = cookieJar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!session || session !== expected) return null;

  const reviewerId =
    cookieJar.get(ADMIN_REVIEWER_COOKIE)?.value?.trim() ||
    "anonymous-reviewer";
  return { reviewerId };
}

/** Set both cookies on a Response. */
export function buildAdminCookieHeaders(
  reviewerName: string
): Array<[string, string]> {
  const expected = process.env.ADMIN_API_KEY ?? "";
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const common = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
  // Secure flag in production only (cookies-without-secure are blocked
  // on HTTPS but useful for local dev over http://localhost).
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return [
    [
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(expected)}; ${common}${secure}`,
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
