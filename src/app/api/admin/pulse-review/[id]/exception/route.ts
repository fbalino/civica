import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import { NextRequest, NextResponse } from "next/server";
import {
  adminMutationProblem,
  withAdminMutation,
  type AdminMutationProblemCode,
} from "@/lib/admin/mutation";
import type { AdminSession } from "@/lib/admin/session";
import { grantPulseReviewException } from "@/lib/pulse/v2/review-sla-store";
import {
  FORM_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  adminPulseReviewExceptionFormSchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type AdminPulseReviewExceptionBody,
} from "@/lib/api/request-body-schemas";

const EXPECTED_EXCEPTION_PROBLEMS: ReadonlyMap<
  string,
  { error: string; code: AdminMutationProblemCode }
> = new Map([
  [
    "Review-SLA exception note must explain the delay",
    {
      error: "The exception note must explain the delay.",
      code: "INVALID_NOTE",
    },
  ],
  [
    "Review-SLA exception must expire in the future",
    {
      error: "The exception must expire in the future.",
      code: "INVALID_EXPIRY",
    },
  ],
  [
    "Review-SLA exception cannot exceed 30 days",
    { error: "The exception cannot exceed 30 days.", code: "INVALID_EXPIRY" },
  ],
  [
    "No eligible open review obligation",
    {
      error: "No eligible open review obligation was found.",
      code: "CONFLICT",
    },
  ],
]);

function safeRedirect(
  value: string | null | undefined,
  eventId: string,
): string {
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
  const parsedId = requestUuidSchema.safeParse(id);
  if (!parsedId.success) return requestInputErrorResponse("INVALID_REQUEST");

  const parsed = await parseBoundedRequestBody<AdminPulseReviewExceptionBody>(
    request,
    {
      maxBytes: REQUEST_BODY_LIMITS.adminPulseReviewException,
      media: [
        {
          mediaType: FORM_MEDIA_TYPE,
          schema: adminPulseReviewExceptionFormSchema,
        },
      ],
    },
  );
  if (!parsed.ok) return parsed.response;
  const { reason, note, redirect } = parsed.data;
  const expiresAt = utcDate(parsed.data.expiresAt);
  id = parsedId.data;
  if (Number.isNaN(expiresAt.getTime())) {
    return adminMutationProblem(
      "INVALID_EXPIRY",
      "Invalid exception expiry",
      400,
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
    const problem =
      error instanceof Error
        ? EXPECTED_EXCEPTION_PROBLEMS.get(error.message)
        : undefined;
    if (!problem) throw error;
    return adminMutationProblem(problem.code, problem.error, 409);
  }
  return NextResponse.redirect(
    new URL(safeRedirect(redirect, id), request.url),
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
