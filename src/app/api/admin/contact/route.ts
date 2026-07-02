import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { verifyAdminBearer } from "@/lib/admin/session";

// Protect with ADMIN_API_KEY env var.
// Set ADMIN_API_KEY in your Vercel project environment variables.
// Call with: Authorization: Bearer <ADMIN_API_KEY>
function isAuthorized(req: NextRequest): boolean {
  return verifyAdminBearer(req.headers.get("authorization"));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
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
