/**
 * Admin session POST/DELETE handler.
 *
 *   POST /api/admin/session   form-encoded { username, password, redirect? }
 *                              → sets cookies, 303 redirects on success,
 *                                303 back to the sign-in page with ?error=1
 *                                on a bad credential.
 *   DELETE /api/admin/session  → clears cookies, 303 redirects to /admin/sign-in
 *
 * Form-encoded so the browser can post directly without JS. The username
 * is constant-time compared to ADMIN_USERNAME and the password is
 * verified against the salted scrypt hash in ADMIN_PASSWORD_HASH — BOTH
 * must match. There is no bearer/API-key path anymore.
 *
 * A durable shared-store throttle runs before request parsing and the
 * password KDF. Session identity is derived by the cookie minter from server
 * configuration, never from client input.
 */

import {
  ADMIN_LOGIN_RATE_LIMIT,
  checkAdminLoginRateLimit,
} from "@/lib/admin/login-rate-limit";
import { withAdminLogout } from "@/lib/admin/logout";
import { recordAdminLoginAudit } from "@/lib/admin/mutation-audit";
import { verifyPassword } from "@/lib/admin/password";
import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import {
  isAdminSessionConfigured,
  mintAdminSessionCookie,
  verifyAdminUsername,
} from "@/lib/admin/session";
import { guardAdminMutationRequest } from "@/lib/api/admin-mutation-request-guard";
import { rateLimitResponse } from "@/lib/api/rate-limit-request";
import { NextRequest, NextResponse } from "next/server";

/** True only when the owner account is fully configured. Fail closed
 *  (and don't disclose which piece is missing) otherwise. */
function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD_HASH &&
    isAdminSessionConfigured(),
  );
}

export async function POST(request: NextRequest) {
  const mutationGuard = guardAdminMutationRequest(request);
  if (!mutationGuard.ok) return mutationGuard.response;

  if (!isAdminConfigured()) {
    return new NextResponse("Admin login is not configured", { status: 500 });
  }

  // This delegates to the shared Postgres-backed atomic limiter, so the
  // attempt budget survives cold starts and is consistent across instances.
  const rateLimit = await checkAdminLoginRateLimit(request);
  if (rateLimit.status !== "allowed") {
    return rateLimitResponse(rateLimit, ADMIN_LOGIN_RATE_LIMIT, {
      limitedMessage: "Too many admin login attempts.",
    });
  }

  let username = "";
  let password = "";
  let redirect = "/admin/pulse-review";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    username = String(form.get("username") ?? "");
    password = String(form.get("password") ?? "");
    redirect = String(form.get("redirect") ?? redirect);
  } else if (contentType.includes("application/json")) {
    const json = (await request.json()) as {
      username?: string;
      password?: string;
      redirect?: string;
    };
    username = json.username ?? "";
    password = json.password ?? "";
    redirect = json.redirect ?? redirect;
  }

  // Verify BOTH halves. Always run the password KDF even when the
  // username is wrong so the response time doesn't reveal whether the
  // username exists (mirrors the constant-time posture elsewhere).
  const usernameOk = verifyAdminUsername(username);
  const passwordOk = await verifyPassword(
    password,
    process.env.ADMIN_PASSWORD_HASH,
  );

  if (!usernameOk || !passwordOk) {
    const failUrl = new URL("/admin/sign-in?error=1", request.url);
    return NextResponse.redirect(failUrl, 303);
  }

  // Sanitise redirect to a same-origin pathname (PLT-027).
  const redirectPath = safeInternalPathOr(redirect, "/admin/pulse-review");
  const minted = mintAdminSessionCookie();
  try {
    await recordAdminLoginAudit({
      session: minted.session,
      route: "/api/admin/session",
      actorSource: "password_login",
    });
  } catch (error) {
    console.error("[admin/session] login audit failed", error);
    return new NextResponse("Admin audit is temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const res = NextResponse.redirect(new URL(redirectPath, request.url), 303);
  for (const [name, value] of minted.headers) {
    res.headers.append(name, value);
  }
  return res;
}

export async function DELETE(request: NextRequest) {
  return withAdminLogout(request, "/api/admin/session");
}
