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
import { parseQueryContract } from "@/lib/api/request-contract";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  isAllowedAdminGoogleAccount,
  isExpectedGoogleIssuer,
  isGoogleSignInConfigured,
  GOOGLE_STATE_COOKIE,
  GOOGLE_REDIRECT_COOKIE,
} from "@/lib/admin/google-oauth";
import {
  isAdminSessionConfigured,
  mintAdminSessionCookie,
} from "@/lib/admin/session";
import { recordAdminLoginAudit } from "@/lib/admin/mutation-audit";
import { apiProblem, withPrivateSafeJsonErrors } from "@/lib/api/problem-response";

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
  return withPrivateSafeJsonErrors("api/admin/google/callback", async () => {
    const failUrl = new URL("/admin/sign-in?error=google", request.url);

    if (!isGoogleSignInConfigured() || !isAdminSessionConfigured()) {
      const response = NextResponse.redirect(failUrl, 303);
      response.headers.set("Cache-Control", "no-store");
      return response;
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

    const query = parseQueryContract(request, "oauth-callback-query/v1");
    if (!query.ok) return query.response;

    const cookieJar = await cookies();
    const expectedState = cookieJar.get(GOOGLE_STATE_COOKIE)?.value;
    const rawRedirect = cookieJar.get(GOOGLE_REDIRECT_COOKIE)?.value;
    const redirectPath = safeInternalPathOr(rawRedirect, "/admin/pulse-review");

    const { code, state, iss } = query.data;

    // Reject a response that names an authorization server other than Google
    // before the code is ever exchanged (RFC 9207 mix-up defence).
    if (
      !isExpectedGoogleIssuer(iss) ||
      !code ||
      !state ||
      !expectedState ||
      state !== expectedState
    ) {
      const res = NextResponse.redirect(failUrl, 303);
      res.headers.set("Cache-Control", "no-store");
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
      res.headers.set("Cache-Control", "no-store");
      for (const [name, value] of clearOAuthCookieHeaders()) {
        res.headers.append(name, value);
      }
      return res;
    }

    const userInfo = await fetchGoogleUserInfo(tokenRes.access_token);
    if (!isAllowedAdminGoogleAccount(userInfo)) {
      const res = NextResponse.redirect(failUrl, 303);
      res.headers.set("Cache-Control", "no-store");
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
      const res = apiProblem("DATA_UNAVAILABLE");
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
  });
}
