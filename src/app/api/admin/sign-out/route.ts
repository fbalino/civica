/**
 * Phase 5.7 — sign-out endpoint (form-friendly).
 *
 * POST /api/admin/sign-out → clears admin cookies, redirects.
 *
 * Browsers can't issue DELETE from a plain <form>, so this dedicated
 * POST handler exists alongside DELETE /api/admin/session for API
 * callers.
 */

import { NextRequest, NextResponse } from "next/server";
import { buildAdminClearCookieHeaders } from "@/lib/admin/session";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(
    new URL("/admin/sign-in", request.url),
    303
  );
  for (const [name, value] of buildAdminClearCookieHeaders()) {
    res.headers.append(name, value);
  }
  return res;
}
