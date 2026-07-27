import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAdminSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
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
