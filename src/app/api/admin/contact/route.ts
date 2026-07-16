import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin/session";
import { shapeAdminContactFeed } from "@/lib/api/admin-feed-shapes";
import { apiProblem, withPrivateSafeJsonErrors } from "@/lib/api/problem-response";
import { parseQueryContract } from "@/lib/api/request-contract";

// Gated on the admin session cookie set by /api/admin/session. Sign in
// at /admin/sign-in with the ADMIN_USERNAME / ADMIN_PASSWORD_HASH
// credentials; there is no bearer/API-key path.
export async function GET(req: NextRequest) {
  return withPrivateSafeJsonErrors("api/admin/contact", async () => {
    if (!(await getAdminSession())) {
      return apiProblem("UNAUTHORIZED");
    }

    const query = parseQueryContract(req, "admin-contact-queue-query/v1");
    if (!query.ok) return query.response;
    const { limit, offset } = query.data;

    try {
      const rows = await db
        .select({
          id: contactSubmissions.id,
          name: contactSubmissions.name,
          email: contactSubmissions.email,
          subject: contactSubmissions.subject,
          message: contactSubmissions.message,
          ipAddress: contactSubmissions.ipAddress,
          status: contactSubmissions.status,
          createdAt: contactSubmissions.createdAt,
        })
        .from(contactSubmissions)
        .orderBy(desc(contactSubmissions.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json(
        shapeAdminContactFeed({ submissions: rows, limit, offset }),
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("[admin/contact] feed unavailable", error);
      return NextResponse.json(
        {
          error: "Admin feed is temporarily unavailable.",
          code: "DATA_UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  });
}
