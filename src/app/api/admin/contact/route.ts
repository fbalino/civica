import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin/session";

// Gated on the admin session cookie set by /api/admin/session. Sign in
// at /admin/sign-in with the ADMIN_USERNAME / ADMIN_PASSWORD_HASH
// credentials; there is no bearer/API-key path.
export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const rows = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ submissions: rows, limit, offset });
}
