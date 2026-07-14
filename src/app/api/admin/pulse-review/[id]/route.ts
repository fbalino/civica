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
 * Auth: the admin session cookie set by /api/admin/session (sign in at
 * /admin/sign-in). There is no bearer/API-key path.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pulseEventsV2, pulseReviewAuditLog } from "@/lib/db/schema";
import { adminMutationProblem, withAdminMutation } from "@/lib/admin/mutation";
import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import type { AdminSession } from "@/lib/admin/session";
import { calculateDimensionalDeltas } from "@/lib/pulse/v2/score";
import { validatePulseClassification } from "@/lib/pulse/v2/review-validation";
import {
  createPulsePipelineRunRef,
  finishPulsePipelineRun,
  startPulsePipelineRun,
} from "@/lib/pulse/v2/pipeline-version";
import {
  latestPulseDecisionKeys,
  persistPulseDecisions,
} from "@/lib/pulse/v2/decision-ledger-store";
import type {
  PulseDecisionInput,
  PulseDecisionKind,
} from "@/lib/pulse/v2/decision-ledger";
import type { PulseDimension, SeverityTier } from "@/lib/pulse/v2/types";
import {
  FORM_MEDIA_TYPE,
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  adminPulseReviewFormBodySchema,
  adminPulseReviewJsonBodySchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type AdminPulseReviewBody,
} from "@/lib/api/request-body-schemas";

async function mutatePulseEvent(
  request: NextRequest,
  id: string,
  auth: AdminSession,
) {
  const parsedId = requestUuidSchema.safeParse(id);
  if (!parsedId.success) return requestInputErrorResponse("INVALID_REQUEST");

  const parsed = await parseBoundedRequestBody<AdminPulseReviewBody>(request, {
    maxBytes: REQUEST_BODY_LIMITS.adminPulseReview,
    media: [
      { mediaType: JSON_MEDIA_TYPE, schema: adminPulseReviewJsonBodySchema },
      { mediaType: FORM_MEDIA_TYPE, schema: adminPulseReviewFormBodySchema },
    ],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const isForm = parsed.mediaType === FORM_MEDIA_TYPE;
  id = parsedId.data;

  const existingRows = await db
    .select()
    .from(pulseEventsV2)
    .where(eq(pulseEventsV2.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) {
    return adminMutationProblem("EVENT_NOT_FOUND", "event not found", 404);
  }
  if (existing.projectionStatus !== "current") {
    return adminMutationProblem(
      "EVENT_NOT_CURRENT",
      "event projection is no longer current",
      409,
    );
  }
  if (existing.reviewStatus !== "pending" || existing.published) {
    return adminMutationProblem(
      "EVENT_NOT_PENDING",
      "event is no longer pending human review",
      409,
    );
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
  let published: boolean = existing.published;
  let reviewStatus: string = existing.reviewStatus;

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

  if (body.action !== "reject") {
    const validation = validatePulseClassification({
      category,
      dimension,
      severityTier,
      severityValue,
    });
    if (!validation.valid) {
      return adminMutationProblem(
        "INVALID_CLASSIFICATION",
        "invalid event classification",
        400,
      );
    }
    ({ category, dimension, severityTier, severityValue } =
      validation.classification);
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

  const reviewRun = createPulsePipelineRunRef("review", {
    upstreamRunIds: [existing.classificationRunId],
  });
  await startPulsePipelineRun(db, reviewRun);
  const decisionKinds: PulseDecisionKind[] = ["publication"];
  if (body.action === "reject") decisionKinds.push("event_existence");
  if (category !== existing.category || dimension !== existing.dimension) {
    decisionKinds.push("category_labels");
  }
  if (
    severityTier !== existing.severityTier ||
    severityValue !== existing.severityValue
  ) {
    decisionKinds.push("severity");
  }
  const superseded = await latestPulseDecisionKeys(db, id, decisionKinds);
  const decidedAt = new Date();

  const updated = await db
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
      updatedAt: decidedAt,
      publicationRunId: published ? reviewRun.id : null,
    })
    .where(
      and(
        eq(pulseEventsV2.id, id),
        eq(pulseEventsV2.projectionStatus, "current"),
        eq(pulseEventsV2.reviewStatus, "pending"),
        eq(pulseEventsV2.published, false),
      ),
    )
    .returning({ id: pulseEventsV2.id });
  if (!updated[0]) {
    await finishPulsePipelineRun(db, reviewRun.id, {
      status: "failed",
      counts: { reviewed: 0 },
      failures: [
        {
          component: "current_projection_guard",
          message: "Event projection changed before the review write.",
        },
      ],
    });
    return adminMutationProblem(
      "EVENT_NOT_CURRENT",
      "event projection is no longer current",
      409,
    );
  }

  await db.insert(pulseReviewAuditLog).values({
    eventId: id,
    reviewerId: auth.reviewerId,
    action: body.action,
    before,
    after,
    notes: body.notes ?? null,
    runId: reviewRun.id,
  });

  const decisionBase = {
    clusterId: existing.clusterId,
    eventId: id,
    actor: {
      type: "human_reviewer" as const,
      provider: null,
      model: null,
      reviewerId: auth.reviewerId,
    },
    stageRunId: reviewRun.id,
    methodVersion: "pulse-review/decision-ledger-v1",
    evidenceRefs: [`event:${id}`],
    decidedAt: decidedAt.toISOString(),
  };
  const reviewDecisions: PulseDecisionInput[] = [
    {
      ...decisionBase,
      kind: "publication",
      verdict: "affirmed",
      payload: {
        eligible: published,
        origin:
          body.action === "reject"
            ? "human_rejected"
            : body.action === "edit"
              ? "human_edited"
              : "human_approved",
        gateReasons: [`human_${body.action}`],
      },
      rationale:
        body.notes?.trim() || `Human reviewer recorded ${body.action}.`,
      supersedesDecisionKey: superseded.publication ?? null,
    },
  ];
  if (body.action === "reject") {
    reviewDecisions.push({
      ...decisionBase,
      kind: "event_existence",
      verdict: "refuted",
      payload: { disposition: "non_event" },
      rationale:
        body.notes?.trim() || "Human reviewer rejected the event candidate.",
      supersedesDecisionKey: superseded.event_existence ?? null,
    });
  }
  if (category !== existing.category || dimension !== existing.dimension) {
    reviewDecisions.push({
      ...decisionBase,
      kind: "category_labels",
      verdict: "affirmed",
      payload: {
        categoryIds: [category],
        dimensionIds: [dimension as PulseDimension],
      },
      rationale:
        body.notes?.trim() || "Human reviewer corrected the category label.",
      supersedesDecisionKey: superseded.category_labels ?? null,
    });
  }
  if (
    severityTier !== existing.severityTier ||
    severityValue !== existing.severityValue
  ) {
    reviewDecisions.push({
      ...decisionBase,
      kind: "severity",
      verdict: "affirmed",
      payload: {
        tier: severityTier as SeverityTier,
        value: severityValue,
        direction:
          severityValue > 0
            ? "positive"
            : severityValue < 0
              ? "negative"
              : "neutral",
      },
      rationale:
        body.notes?.trim() || "Human reviewer corrected the severity judgment.",
      supersedesDecisionKey: superseded.severity ?? null,
    });
  }
  await persistPulseDecisions(db, reviewDecisions);

  await finishPulsePipelineRun(db, reviewRun.id, {
    status: "completed",
    counts: {
      decisions: reviewDecisions.length,
      published: published ? 1 : 0,
      rejected: body.action === "reject" ? 1 : 0,
      edited: body.action === "edit" ? 1 : 0,
    },
  });

  // Refresh dimensional deltas so the country page reflects this
  // decision immediately. Without this, country-page Pulse panels
  // stay flat until the next daily score cron. ~1s for current
  // event volume; revisit if pulse_events_v2 grows past ~10k rows.
  try {
    await calculateDimensionalDeltas(db);
  } catch (err) {
    // Don't fail the review action if scoring hiccups — the daily
    // cron will catch up. Log so the issue is visible.
    console.error("[pulse-review] delta recompute failed", err);
  }

  if (isForm) {
    const redirect = safeInternalPathOr(body.redirect, "/admin/pulse-review");
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json({ ok: true, action: body.action, after });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAdminMutation(
    request,
    {
      route: "/api/admin/pulse-review/[id]",
      action: "pulse_event.review",
      targetType: "pulse_event",
      targetId: id,
    },
    (auth) => mutatePulseEvent(request, id, auth),
  );
}
