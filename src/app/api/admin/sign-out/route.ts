/**
 * Phase 5.7 — sign-out endpoint (form-friendly).
 *
 * POST /api/admin/sign-out → clears admin cookies, redirects.
 *
 * Browsers can't issue DELETE from a plain <form>, so this dedicated
 * POST handler exists alongside DELETE /api/admin/session for API
 * callers.
 */

import { withAdminLogout } from "@/lib/admin/logout";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return withAdminLogout(request, "/api/admin/sign-out");
}
