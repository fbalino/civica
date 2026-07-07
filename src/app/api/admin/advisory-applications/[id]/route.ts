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
 * Auth: the admin session cookie set by /api/admin/session (sign in at
 * /admin/sign-in) — the same session-only gate as
 * `/api/admin/data-disputes/[id]`.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { advisoryApplications } from "@/lib/db/schema";
import { getAdminSession } from "@/lib/admin/session";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdminSession();
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
