/**
 * Phase 5.7 — admin session POST/DELETE handler.
 *
 *   POST /api/admin/session   form-encoded { token, reviewerName, redirect? }
 *                              → sets cookies, 303 redirects on success
 *   DELETE /api/admin/session  → clears cookies, 303 redirects to /admin/sign-in
 *
 * Form-encoded so the browser can post directly without JS. Bearer
 * Auth header still works against `/api/admin/*` for non-browser
 * callers — that path is handled by isAuthorized() in each route.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildAdminCookieHeaders,
  buildAdminClearCookieHeaders,
} from "@/lib/admin/session";

export async function POST(request: NextRequest) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return new NextResponse("ADMIN_API_KEY not configured", { status: 500 });
  }

  let token = "";
  let reviewerName = "";
  let redirect = "/admin/pulse-review";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
    reviewerName = String(form.get("reviewerName") ?? "");
    redirect = String(form.get("redirect") ?? redirect);
  } else if (contentType.includes("application/json")) {
    const json = (await request.json()) as {
      token?: string;
      reviewerName?: string;
      redirect?: string;
    };
    token = json.token ?? "";
    reviewerName = json.reviewerName ?? "";
    redirect = json.redirect ?? redirect;
  }

  if (token !== expected) {
    const failUrl = new URL("/admin/sign-in?error=1", request.url);
    return NextResponse.redirect(failUrl, 303);
  }

  // Sanitise reviewerName to a-zA-Z0-9 space, hyphen, dot, underscore;
  // fall back to anonymous when empty.
  const cleanName =
    reviewerName.replace(/[^a-zA-Z0-9 _.\-]/g, "").trim().slice(0, 80) ||
    "anonymous-reviewer";

  // Sanitise redirect to a same-origin pathname.
  const redirectPath = redirect.startsWith("/") ? redirect : "/admin/pulse-review";

  const res = NextResponse.redirect(new URL(redirectPath, request.url), 303);
  for (const [name, value] of buildAdminCookieHeaders(cleanName)) {
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
