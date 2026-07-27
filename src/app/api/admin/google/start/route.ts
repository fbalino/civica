/**
 * GET /api/admin/google/start?redirect=/admin/...
 *
 * Kicks off the "Sign in with Google" flow from /admin/sign-in: mints a
 * random CSRF `state`, stashes it (and the post-login redirect target) in
 * short-lived HttpOnly cookies, then 303s to Google's consent screen. The
 * callback route verifies the returned state against this cookie before
 * exchanging the authorization code.
 */

import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  buildGoogleAuthorizeUrl,
  isGoogleSignInConfigured,
  GOOGLE_STATE_COOKIE,
  GOOGLE_REDIRECT_COOKIE,
} from "@/lib/admin/google-oauth";

export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) {
    return new NextResponse("Google sign-in is not configured", {
      status: 500,
    });
  }

  const redirectPath = safeInternalPathOr(
    request.nextUrl.searchParams.get("redirect"),
    "/admin/pulse-review",
  );

  const state = randomBytes(24).toString("hex");
  const callbackUrl = new URL(
    "/api/admin/google/callback",
    request.nextUrl.origin,
  );
  const authorizeUrl = buildGoogleAuthorizeUrl({
    redirectUri: callbackUrl.toString(),
    state,
  });

  const res = NextResponse.redirect(authorizeUrl, 303);
  // SameSite=Lax (not Strict) because these cookies must survive the
  // top-level cross-site redirect back from accounts.google.com.
  const common = "Path=/; HttpOnly; SameSite=Lax; Max-Age=600";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `${GOOGLE_STATE_COOKIE}=${state}; ${common}${secure}`,
  );
  res.headers.append(
    "Set-Cookie",
    `${GOOGLE_REDIRECT_COOKIE}=${encodeURIComponent(redirectPath)}; ${common}${secure}`,
  );
  return res;
}
