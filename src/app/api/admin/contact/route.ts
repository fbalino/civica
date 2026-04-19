import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// Protect with ADMIN_API_KEY env var.
// Set ADMIN_API_KEY in your Vercel project environment variables.
// Call with: Authorization: Bearer <ADMIN_API_KEY>
function isAuthorized(req: NextRequest): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${key}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const rows = await db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ submissions: rows, limit, offset });
}
