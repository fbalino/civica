import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import { NextRequest, NextResponse } from "next/server";
import { withAdminMutation } from "@/lib/admin/mutation";
import type { AdminSession } from "@/lib/admin/session";
import {
  PULSE_REVIEW_EXCEPTION_REASONS,
  grantPulseReviewException,
  type PulseReviewExceptionReason,
} from "@/lib/pulse/v2/review-sla-store";

function safeRedirect(value: string | null, eventId: string): string {
  return safeInternalPathOr(value, `/admin/pulse-review/${eventId}`);
}

function utcDate(value: string): Date {
  const explicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  return new Date(explicitOffset ? value : `${value}Z`);
}

async function mutatePulseReviewException(
  request: NextRequest,
  id: string,
  auth: AdminSession,
) {
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "") as PulseReviewExceptionReason;
  const note = String(form.get("note") ?? "");
  const expiresAt = utcDate(String(form.get("expiresAt") ?? ""));
  if (!PULSE_REVIEW_EXCEPTION_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: "Invalid exception reason" },
      { status: 400 },
    );
  }
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid exception expiry" },
      { status: 400 },
    );
  }

  try {
    await grantPulseReviewException({
      eventId: id,
      actorId: auth.reviewerId,
      reason,
      note,
      expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Exception was not recorded",
      },
      { status: 409 },
    );
  }
  return NextResponse.redirect(
    new URL(safeRedirect(String(form.get("redirect") ?? ""), id), request.url),
    303,
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAdminMutation(
    request,
    {
      route: "/api/admin/pulse-review/[id]/exception",
      action: "pulse_review_exception.grant",
      targetType: "pulse_event",
      targetId: id,
    },
    (auth) => mutatePulseReviewException(request, id, auth),
  );
}
