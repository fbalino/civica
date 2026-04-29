/**
 * Phase 5.7 — review-decision endpoint.
 *
 * POST /api/admin/pulse-review/[id]
 *
 * Form body or JSON:
 *   action       'approve' | 'edit' | 'reject'   (required)
 *   category     event category id              (only for 'edit')
 *   dimension    dq | rol | fnr | cc | stability (only for 'edit')
 *   severityTier severity tier id               (only for 'edit')
 *   severityValue numeric severity              (only for 'edit')
 *   notes        reviewer notes                 (any action)
 *   redirect     post-success redirect path     (defaults to queue)
 *
 * On success, the row's review_status flips to approved/edited/rejected,
 * `published` becomes true for approve+edit, and an audit log row is
 * inserted with the before/after snapshot. Form callers get a 303
 * redirect; JSON callers get JSON.
 *
 * Auth: either Bearer ADMIN_API_KEY header (CLI / API callers) or
 * the admin session cookie set by /api/admin/session.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pulseEventsV2,
  pulseReviewAuditLog,
} from "@/lib/db/schema";
import {
  getAdminSession,
  ADMIN_REVIEWER_COOKIE,
} from "@/lib/admin/session";

type Action = "approve" | "edit" | "reject";

const VALID_ACTIONS: Set<Action> = new Set(["approve", "edit", "reject"]);

interface ReviewBody {
  action: Action;
  category?: string;
  dimension?: string;
  severityTier?: string;
  severityValue?: number;
  notes?: string;
  redirect?: string;
}

async function readBody(
  request: NextRequest
): Promise<{ body: ReviewBody; isForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return {
      isForm: true,
      body: {
        action: String(form.get("action") ?? "") as Action,
        category: form.get("category")
          ? String(form.get("category"))
          : undefined,
        dimension: form.get("dimension")
          ? String(form.get("dimension"))
          : undefined,
        severityTier: form.get("severityTier")
          ? String(form.get("severityTier"))
          : undefined,
        severityValue: form.get("severityValue")
          ? Number(form.get("severityValue"))
          : undefined,
        notes: form.get("notes") ? String(form.get("notes")) : undefined,
        redirect: form.get("redirect")
          ? String(form.get("redirect"))
          : undefined,
      },
    };
  }
  const json = (await request.json()) as ReviewBody;
  return { isForm: false, body: json };
}

async function authorize(
  request: NextRequest
): Promise<{ reviewerId: string } | null> {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return null;
  // Bearer header path
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${expected}`) {
    const reviewerHeader = request.headers.get("x-civica-reviewer");
    return { reviewerId: reviewerHeader?.trim() || "api-bearer" };
  }
  // Cookie session path
  const session = await getAdminSession();
  if (session) return { reviewerId: session.reviewerId };
  // Fallback: read cookies directly off the request for clients that
  // can't await next/headers — e.g. test harnesses.
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (cookieHeader.includes(`civica_admin_session=${encodeURIComponent(expected)}`)) {
    const reviewerMatch = cookieHeader.match(
      new RegExp(`${ADMIN_REVIEWER_COOKIE}=([^;]+)`)
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
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { body, isForm } = await readBody(request);

  if (!VALID_ACTIONS.has(body.action)) {
    return NextResponse.json(
      { error: "invalid action" },
      { status: 400 }
    );
  }

  const existingRows = await db
    .select()
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "event not found" }, { status: 404 });
  }

  const before = {
    category: existing.category,
    dimension: existing.dimension,
    severityTier: existing.severityTier,
    severityValue: existing.severityValue,
    published: existing.published,
    reviewStatus: existing.reviewStatus,
    reviewNotes: existing.reviewNotes,
  };

  // Compute the new state per action
  let category = existing.category;
  let dimension = existing.dimension;
  let severityTier = existing.severityTier;
  let severityValue = existing.severityValue;
  let published = existing.published;
  let reviewStatus = existing.reviewStatus;

  if (body.action === "approve") {
    published = true;
    reviewStatus = "approved";
  } else if (body.action === "edit") {
    if (body.category) category = body.category;
    if (body.dimension) dimension = body.dimension;
    if (body.severityTier) severityTier = body.severityTier;
    if (typeof body.severityValue === "number")
      severityValue = body.severityValue;
    published = true;
    reviewStatus = "edited";
  } else {
    // reject
    published = false;
    reviewStatus = "rejected";
  }

  const after = {
    category,
    dimension,
    severityTier,
    severityValue,
    published,
    reviewStatus,
    reviewNotes: body.notes ?? existing.reviewNotes,
  };

  await db
    .update(pulseEventsV2)
    .set({
      category,
      dimension,
      severityTier,
      severityValue,
      published,
      reviewStatus,
      humanReviewed: true,
      reviewerId: auth.reviewerId,
      reviewNotes: body.notes ?? existing.reviewNotes,
      updatedAt: new Date(),
    })
    .where(eq(pulseEventsV2.id, id));

  await db.insert(pulseReviewAuditLog).values({
    eventId: id,
    reviewerId: auth.reviewerId,
    action: body.action,
    before,
    after,
    notes: body.notes ?? null,
  });

  if (isForm) {
    const redirect = body.redirect ?? "/admin/pulse-review";
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json({ ok: true, action: body.action, after });
}
