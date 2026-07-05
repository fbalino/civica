/**
 * Advisory-application status mutation.
 *
 * POST /api/admin/advisory-applications/[id]
 *
 * Form body or JSON:
 *   status     'new' | 'reviewed' | 'contacted' | 'archived'   (required)
 *   redirect   post-success redirect path                       (default: queue)
 *
 * Flips the application's triage status so the admin queue's status filter
 * chips (Reviewed / Contacted / Archived) reflect reality instead of every row
 * being stuck on `new`. Form callers get a 303 redirect back to the queue; JSON
 * callers get JSON.
 *
 * Auth: Bearer ADMIN_API_KEY (CLI / API) or admin session cookie — the same
 * `authorize()` shape as `/api/admin/data-disputes/[id]`.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import {
  getAdminSession,
  verifyAdminBearer,
  sanitizeReviewerName,
  ADMIN_REVIEWER_COOKIE,
} from "@/lib/admin/session";

const VALID_STATUSES = ["new", "reviewed", "contacted", "archived"] as const;
type Status = (typeof VALID_STATUSES)[number];

function isStatus(value: unknown): value is Status {
  return (
    typeof value === "string" &&
    (VALID_STATUSES as readonly string[]).includes(value)
  );
}

interface StatusBody {
  status?: string;
  redirect?: string;
}

async function readBody(
  request: NextRequest,
): Promise<{ body: StatusBody; isForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return {
      isForm: true,
      body: {
        status: form.get("status") ? String(form.get("status")) : undefined,
        redirect: form.get("redirect")
          ? String(form.get("redirect"))
          : undefined,
      },
    };
  }
  const json = (await request.json()) as StatusBody;
  return { isForm: false, body: json };
}

async function authorize(
  request: NextRequest,
): Promise<{ reviewerId: string } | null> {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return null;
  // Bearer header path (constant-time compare).
  if (verifyAdminBearer(request.headers.get("authorization"))) {
    const reviewerHeader = request.headers.get("x-civica-reviewer");
    return { reviewerId: sanitizeReviewerName(reviewerHeader, "api-bearer") };
  }
  // Cookie session path.
  const session = await getAdminSession();
  if (session) return { reviewerId: session.reviewerId };
  // Fallback: read cookies directly off the request (test harnesses).
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (
    cookieHeader.includes(`civica_admin_session=${encodeURIComponent(expected)}`)
  ) {
    const reviewerMatch = cookieHeader.match(
      new RegExp(`${ADMIN_REVIEWER_COOKIE}=([^;]+)`),
    );
    return {
      reviewerId: reviewerMatch
        ? decodeURIComponent(reviewerMatch[1])
        : "anonymous-reviewer",
    };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { body, isForm } = await readBody(request);

  if (!isStatus(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const updated = await db
    .update(advisoryApplications)
    .set({ status: body.status })
    .where(eq(advisoryApplications.id, id))
    .returning({ id: advisoryApplications.id });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "application not found" },
      { status: 404 },
    );
  }

  if (isForm) {
    const redirect = body.redirect ?? "/admin/advisory-applications";
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json({
    ok: true,
    id,
    status: body.status,
    reviewerId: auth.reviewerId,
  });
}
