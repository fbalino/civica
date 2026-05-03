/**
 * Phase F.5 — dispute resolution endpoint.
 *
 * POST /api/admin/data-disputes/[id]
 *
 * Form body or JSON:
 *   action     'resolve_a' | 'resolve_b' | 'hold' | 'reject' (required)
 *   notes      reviewer notes                                 (optional)
 *   redirect   post-success redirect path                     (default: queue)
 *
 * On success, the row's status flips per the action map below,
 * `resolved_at` is stamped, and reviewer fields are populated. Form
 * callers get a 303 redirect; JSON callers get JSON.
 *
 * Auth: Bearer ADMIN_API_KEY (CLI / API) or admin session cookie.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §7
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataDisputes } from "@/lib/db/schema";
import {
  getAdminSession,
  ADMIN_REVIEWER_COOKIE,
} from "@/lib/admin/session";

type Action = "resolve_a" | "resolve_b" | "hold" | "reject";

const VALID_ACTIONS: Set<Action> = new Set([
  "resolve_a",
  "resolve_b",
  "hold",
  "reject",
]);

const ACTION_TO_STATUS: Record<Action, string> = {
  resolve_a: "resolved_a_wins",
  resolve_b: "resolved_b_wins",
  hold: "resolved_held",
  reject: "rejected_invalid",
};

interface ResolveBody {
  action: Action;
  notes?: string;
  redirect?: string;
}

async function readBody(
  request: NextRequest,
): Promise<{ body: ResolveBody; isForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return {
      isForm: true,
      body: {
        action: String(form.get("action") ?? "") as Action,
        notes: form.get("notes") ? String(form.get("notes")) : undefined,
        redirect: form.get("redirect")
          ? String(form.get("redirect"))
          : undefined,
      },
    };
  }
  const json = (await request.json()) as ResolveBody;
  return { isForm: false, body: json };
}

async function authorize(
  request: NextRequest,
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
  // Fallback: read cookies directly off the request (test harnesses).
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (
    cookieHeader.includes(
      `civica_admin_session=${encodeURIComponent(expected)}`,
    )
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

  if (!VALID_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const existingRows = await db
    .select()
    .from(dataDisputes)
    .where(eq(dataDisputes.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "dispute not found" }, { status: 404 });
  }

  const newStatus = ACTION_TO_STATUS[body.action];
  const now = new Date();

  await db
    .update(dataDisputes)
    .set({
      status: newStatus,
      reviewerId: auth.reviewerId,
      reviewerNotes: body.notes ?? existing.reviewerNotes,
      resolvedAt: now,
      // resolutionAction stores the action verbatim for downstream
      // analytics / replay; it's distinct from `proposed_action` (the
      // resolver's auto-suggestion) so we keep both.
      resolutionAction: body.action,
    })
    .where(eq(dataDisputes.id, id));

  if (isForm) {
    const redirect = body.redirect ?? `/admin/data-disputes/${id}`;
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json({
    ok: true,
    action: body.action,
    status: newStatus,
    reviewerId: auth.reviewerId,
    resolvedAt: now.toISOString(),
  });
}
