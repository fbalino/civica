/**
 * Google OAuth 2.0 (Authorization Code flow) for the admin sign-in's
 * "Sign in with Google" option. Hand-rolled — no NextAuth/passport — to
 * match the existing minimal, dependency-free admin-session design (see
 * `src/lib/admin/session.ts`).
 *
 * This is NOT a new account system: it's a second door into the SAME
 * single-owner admin session. A successful Google sign-in must resolve to
 * an email that exactly matches `ADMIN_GOOGLE_EMAIL` and that Google
 * reports as verified — anything else fails closed. On success the caller
 * issues the normal admin session cookies via `buildAdminCookieHeaders`.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Short-lived cookies used only during the OAuth round trip (cleared by
 *  the callback route once consumed). Distinct from the admin session
 *  cookies in session.ts. */
export const GOOGLE_STATE_COOKIE = "civica_admin_google_state";
export const GOOGLE_REDIRECT_COOKIE = "civica_admin_google_redirect";

/** True only when all three Google-sign-in env vars are set. Fail closed
 *  otherwise — mirrors isAdminConfigured() for the password flow. */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.ADMIN_GOOGLE_EMAIL,
  );
}

export function buildGoogleAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  // Always show the account chooser rather than silently reusing whatever
  // Google session happens to be active in the browser.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return {};
  return res.json();
}

/** The single allow-listed admin Google account. Requires Google's own
 *  `email_verified` flag so an unverified/spoofable address can't pass. */
export function isAllowedAdminGoogleAccount(userInfo: GoogleUserInfo): boolean {
  const expected = process.env.ADMIN_GOOGLE_EMAIL;
  if (!expected || !userInfo.email || !userInfo.email_verified) return false;
  return userInfo.email.toLowerCase() === expected.toLowerCase();
}
