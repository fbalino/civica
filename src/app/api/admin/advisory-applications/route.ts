import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifyAdminBearer } from "@/lib/admin/session";

// Protect with ADMIN_API_KEY env var (mirrors /api/admin/contact).
// Call with: Authorization: Bearer <ADMIN_API_KEY>
function isAuthorized(req: NextRequest): boolean {
  return verifyAdminBearer(req.headers.get("authorization"));
}

const VALID_STATUSES = ["new", "reviewed", "contacted", "archived"] as const;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    0,
  );
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? statusParam
      : undefined;

  const base = db.select().from(advisoryApplications);
  const rows = await (status
    ? base.where(eq(advisoryApplications.status, status))
    : base
  )
    .orderBy(desc(advisoryApplications.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ applications: rows, limit, offset, status });
}
