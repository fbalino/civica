/**
 * GET /api/admin/google/callback?code=...&state=...
 *
 * Verifies the CSRF state cookie set by /api/admin/google/start, exchanges
 * the authorization code for a Google access token, fetches the account's
 * email, and — ONLY when it exactly matches ADMIN_GOOGLE_EMAIL and Google
 * reports it verified — issues the same admin session cookies the
 * password flow uses (mintAdminSessionCookie). Any mismatch, missing
 * config, or malformed callback fails closed to /admin/sign-in?error=google.
 */

import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import {
  checkRequestRateLimit,
  rateLimitResponse,
} from "@/lib/api/rate-limit-request";
import { getRequestRateLimitPolicy } from "@/lib/api/rate-limit-runtime-policy";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  isAllowedAdminGoogleAccount,
  isGoogleSignInConfigured,
  GOOGLE_STATE_COOKIE,
  GOOGLE_REDIRECT_COOKIE,
} from "@/lib/admin/google-oauth";
import {
  isAdminSessionConfigured,
  mintAdminSessionCookie,
} from "@/lib/admin/session";
import { recordAdminLoginAudit } from "@/lib/admin/mutation-audit";

const ADMIN_OAUTH_RATE_LIMIT_POLICY = getRequestRateLimitPolicy(
  "admin-oauth-bootstrap",
);

function clearOAuthCookieHeaders(): Array<[string, string]> {
  return [
    ["Set-Cookie", `${GOOGLE_STATE_COOKIE}=; Path=/; HttpOnly; Max-Age=0`],
    ["Set-Cookie", `${GOOGLE_REDIRECT_COOKIE}=; Path=/; HttpOnly; Max-Age=0`],
  ];
}

export async function GET(request: NextRequest) {
  const failUrl = new URL("/admin/sign-in?error=google", request.url);

  if (!isGoogleSignInConfigured() || !isAdminSessionConfigured()) {
    return NextResponse.redirect(failUrl, 303);
  }

  const rateLimit = await checkRequestRateLimit(
    request,
    ADMIN_OAUTH_RATE_LIMIT_POLICY,
  );
  if (rateLimit.status !== "allowed") {
    return rateLimitResponse(rateLimit, ADMIN_OAUTH_RATE_LIMIT_POLICY, {
      limitedMessage:
        "Too many sign-in attempts. Please wait before trying again.",
    });
  }

  const cookieJar = await cookies();
  const expectedState = cookieJar.get(GOOGLE_STATE_COOKIE)?.value;
  const rawRedirect = cookieJar.get(GOOGLE_REDIRECT_COOKIE)?.value;
  const redirectPath = safeInternalPathOr(rawRedirect, "/admin/pulse-review");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state || !expectedState || state !== expectedState) {
    const res = NextResponse.redirect(failUrl, 303);
    for (const [name, value] of clearOAuthCookieHeaders()) {
      res.headers.append(name, value);
    }
    return res;
  }

  const callbackUrl = new URL(
    "/api/admin/google/callback",
    request.nextUrl.origin,
  );
  const tokenRes = await exchangeGoogleCode(code, callbackUrl.toString());
  if (!tokenRes.access_token) {
    const res = NextResponse.redirect(failUrl, 303);
    for (const [name, value] of clearOAuthCookieHeaders()) {
      res.headers.append(name, value);
    }
    return res;
  }

  const userInfo = await fetchGoogleUserInfo(tokenRes.access_token);
  if (!isAllowedAdminGoogleAccount(userInfo)) {
    const res = NextResponse.redirect(failUrl, 303);
    for (const [name, value] of clearOAuthCookieHeaders()) {
      res.headers.append(name, value);
    }
    return res;
  }

  const minted = mintAdminSessionCookie();
  try {
    await recordAdminLoginAudit({
      session: minted.session,
      route: "/api/admin/google/callback",
      actorSource: "google_login",
    });
  } catch (error) {
    console.error("[admin/google/callback] login audit failed", error);
    const res = new NextResponse("Admin audit is temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
    for (const [name, value] of clearOAuthCookieHeaders()) {
      res.headers.append(name, value);
    }
    return res;
  }

  const res = NextResponse.redirect(new URL(redirectPath, request.url), 303);
  for (const [name, value] of clearOAuthCookieHeaders()) {
    res.headers.append(name, value);
  }
  for (const [name, value] of minted.headers) {
    res.headers.append(name, value);
  }
  return res;
}
