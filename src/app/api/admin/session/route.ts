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
 * The reviewer display name written to the session cookie is the
 * server-configured name (ADMIN_DISPLAY_NAME || ADMIN_USERNAME), NOT a
 * client-supplied value, so audit-log rows always attribute to the
 * owner account.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminCookieHeaders,
  buildAdminClearCookieHeaders,
  verifyAdminUsername,
  adminReviewerName,
} from "@/lib/admin/session";
import { verifyPassword } from "@/lib/admin/password";

/** True only when the owner account is fully configured. Fail closed
 *  (and don't disclose which piece is missing) otherwise. */
function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD_HASH &&
      process.env.ADMIN_SESSION_SECRET,
  );
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return new NextResponse("Admin login is not configured", { status: 500 });
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

  // Sanitise redirect to a same-origin pathname.
  const redirectPath = redirect.startsWith("/")
    ? redirect
    : "/admin/pulse-review";

  const res = NextResponse.redirect(new URL(redirectPath, request.url), 303);
  for (const [name, value] of buildAdminCookieHeaders(adminReviewerName())) {
    res.headers.append(name, value);
  }
  return res;
}

export async function DELETE(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/sign-in", request.url), 303);
  for (const [name, value] of buildAdminClearCookieHeaders()) {
    res.headers.append(name, value);
  }
  return res;
}
