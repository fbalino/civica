/**
 * Phase F.5 — dispute resolution endpoint.
 * Extended in R.21 with `reopen` action + audit-log writes on every
 * state change.
 *
 * POST /api/admin/data-disputes/[id]
 *
 * Form body or JSON:
 *   action     'resolve_a' | 'resolve_b' | 'hold' | 'reject' | 'reopen'
 *              (required)
 *   notes      reviewer notes                                 (optional)
 *   redirect   post-success redirect path                     (default: queue)
 *
 * On success the row's status flips per the action map below,
 * `resolved_at` is stamped (or cleared on reopen), reviewer fields
 * are populated, and a `data_facts_audit_log` row is written with
 * the pre/post snapshots and reviewer notes. Form callers get a
 * 303 redirect; JSON callers get JSON.
 *
 * `reopen` flips a previously-resolved dispute back to `status='open'`,
 * clears `resolved_at` / `resolution_action`, preserves reviewer notes
 * (history), and writes an audit-log row with `action='reopen'`. It
 * does NOT undo `country_facts` demotions — manual de-demotion is
 * out of scope for v1.0 (see resolution doc §6 Q3).
 *
 * Auth: Bearer ADMIN_API_KEY (CLI / API) or admin session cookie.
 *
 * Methodology:
 *   - Phase F.5: ~/civica/plan/phase-f-methodology-v0.1.md §7
 *   - R.21 audit-log + reopen: ~/civica/plan/disputes-triage-resolution-v1.md §2b
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { countryFacts, dataDisputes } from "@/lib/db/schema";
import {
  getAdminSession,
  ADMIN_REVIEWER_COOKIE,
} from "@/lib/admin/session";
import {
  snapshotDispute,
  writeDisputeAuditLog,
  type DisputeAuditAction,
} from "@/lib/factbook/reconcile/dispute-audit-log";

type Action = "resolve_a" | "resolve_b" | "hold" | "reject" | "reopen";

const VALID_ACTIONS: Set<Action> = new Set([
  "resolve_a",
  "resolve_b",
  "hold",
  "reject",
  "reopen",
]);

const ACTION_TO_STATUS: Record<Exclude<Action, "reopen">, string> = {
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

  const beforeSnap = snapshotDispute(existing);
  const now = new Date();

  // ── Reopen branch ────────────────────────────────────────────────
  if (body.action === "reopen") {
    // Reopen is only meaningful on resolved/rejected rows. Reopening
    // an already-open dispute is a no-op (return ok).
    const isResolved =
      existing.status.startsWith("resolved_") ||
      existing.status === "rejected_invalid";
    if (!isResolved) {
      return NextResponse.json(
        { ok: true, action: "reopen", status: existing.status, noop: true },
      );
    }

    await db
      .update(dataDisputes)
      .set({
        status: "open",
        resolvedAt: null,
        resolutionAction: null,
        // reviewerId / reviewerNotes preserved as historical context;
        // the audit-log row is what carries the reopen reviewer.
      })
      .where(eq(dataDisputes.id, id));

    const afterRows = await db
      .select()
      .from(dataDisputes)
      .where(eq(dataDisputes.id, id))
      .limit(1);
    const after = afterRows[0] ?? existing;

    await writeDisputeAuditLog({
      dispute: after,
      action: "reopen" as DisputeAuditAction,
      actorId: auth.reviewerId,
      before: beforeSnap,
      after: snapshotDispute(after),
      notes: body.notes ?? null,
    });

    if (isForm) {
      const redirect = body.redirect ?? `/admin/data-disputes/${id}`;
      return NextResponse.redirect(new URL(redirect, request.url), 303);
    }
    return NextResponse.json({
      ok: true,
      action: "reopen",
      status: "open",
      reviewerId: auth.reviewerId,
    });
  }

  // ── Resolve / hold / reject branch ───────────────────────────────
  const newStatus = ACTION_TO_STATUS[body.action];

  // Phase F.5.1 — wire the reviewer decision through to the resolver.
  // For 'resolve_a' / 'resolve_b' we identify the winner row, then
  // demote every OTHER active country_facts row for the same
  // (jurisdiction, fact_key). The resolver only consumes status='active'
  // rows (see resolver.ts), so flipping the loser to 'demoted' makes
  // the next read return the reviewer-chosen value.
  //
  // 'hold' / 'reject' leave country_facts untouched — the dispute
  // resolution is recorded for audit and the resolver continues to
  // compute canonical via methodology rules.
  let demotedCount = 0;
  if (body.action === "resolve_a" || body.action === "resolve_b") {
    const winnerId =
      body.action === "resolve_a" ? existing.factIdA : existing.factIdB;
    if (!winnerId) {
      return NextResponse.json(
        {
          error:
            body.action === "resolve_a"
              ? "cannot resolve in favour of A: dispute has no fact_id_a"
              : "cannot resolve in favour of B: dispute has no fact_id_b",
        },
        { status: 400 },
      );
    }
    const demoteResult = await db
      .update(countryFacts)
      .set({
        status: "demoted",
        // Status reason carries the dispute id so the audit trail can
        // be reconstructed even if data_disputes evolves later.
        statusReason: `demoted_by_dispute_${id}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(countryFacts.jurisdictionId, existing.jurisdictionId),
          eq(countryFacts.factKey, existing.factKey),
          ne(countryFacts.id, winnerId),
          eq(countryFacts.status, "active"),
        ),
      )
      .returning({ id: countryFacts.id });
    demotedCount = demoteResult.length;
  }

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

  // Re-read the post-update row so the audit-log captures committed
  // state, defensive against races. Then write the audit-log row.
  const afterRows = await db
    .select()
    .from(dataDisputes)
    .where(eq(dataDisputes.id, id))
    .limit(1);
  const after = afterRows[0] ?? existing;
  try {
    await writeDisputeAuditLog({
      dispute: after,
      action: "reviewer_decision" as DisputeAuditAction,
      actorId: auth.reviewerId,
      before: beforeSnap,
      after: snapshotDispute(after),
      notes: body.notes ?? null,
    });
  } catch (err) {
    // Audit-log failure should NOT block the reviewer's update —
    // their decision is committed in `data_disputes` already. Surface
    // a console warning so a regression is visible in logs.
    console.warn(
      "[admin/data-disputes] audit-log insert failed:",
      err instanceof Error ? err.message : err,
    );
  }

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
    demotedFactIds: demotedCount,
  });
}
