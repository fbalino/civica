import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAdminSession } from "@/lib/admin/session";
import { shapeAdminAdvisoryFeed } from "@/lib/api/admin-feed-shapes";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { parseQueryContract } from "@/lib/api/request-contract";

// Gated on the admin session cookie set by /api/admin/session (mirrors
// /api/admin/contact). Sign in at /admin/sign-in; no bearer/API-key path.

export async function GET(req: NextRequest) {
  return withSafeJsonErrors("api/admin/advisory-applications", async () => {
    if (!(await getAdminSession())) {
      return apiProblem("UNAUTHORIZED");
    }

    const query = parseQueryContract(req, "admin-advisory-queue-query/v1");
    if (!query.ok) return query.response;
    const { limit, offset, status } = query.data;

    try {
      const base = db
        .select({
          id: advisoryApplications.id,
          name: advisoryApplications.name,
          email: advisoryApplications.email,
          institution: advisoryApplications.institution,
          role: advisoryApplications.role,
          expertiseArea: advisoryApplications.expertiseArea,
          experience: advisoryApplications.experience,
          links: advisoryApplications.links,
          cvUrl: advisoryApplications.cvUrl,
          status: advisoryApplications.status,
          createdAt: advisoryApplications.createdAt,
        })
        .from(advisoryApplications);
      const rows = await (
        status ? base.where(eq(advisoryApplications.status, status)) : base
      )
        .orderBy(desc(advisoryApplications.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json(
        shapeAdminAdvisoryFeed({ applications: rows, limit, offset, status }),
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("[admin/advisory-applications] feed unavailable", error);
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
