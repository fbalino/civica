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
import { adminMutationProblem, withAdminMutation } from "@/lib/admin/mutation";
import { safeInternalPathOr } from "@/lib/admin/safe-redirect";
import type { AdminSession } from "@/lib/admin/session";
import {
  FORM_MEDIA_TYPE,
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  adminAdvisoryMutationFormSchema,
  adminAdvisoryMutationBodySchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type AdminAdvisoryMutationBody,
} from "@/lib/api/request-body-schemas";

const VALID_STATUSES = ["new", "reviewed", "contacted", "archived"] as const;
type Status = (typeof VALID_STATUSES)[number];

function isStatus(value: unknown): value is Status {
  return (
    typeof value === "string" &&
    (VALID_STATUSES as readonly string[]).includes(value)
  );
}

async function mutateAdvisoryApplication(
  request: NextRequest,
  id: string,
  auth: AdminSession,
) {
  const parsedId = requestUuidSchema.safeParse(id);
  if (!parsedId.success) return requestInputErrorResponse("INVALID_REQUEST");

  const parsed = await parseBoundedRequestBody<AdminAdvisoryMutationBody>(
    request,
    {
      maxBytes: REQUEST_BODY_LIMITS.adminAdvisoryMutation,
      media: [
        { mediaType: JSON_MEDIA_TYPE, schema: adminAdvisoryMutationBodySchema },
        { mediaType: FORM_MEDIA_TYPE, schema: adminAdvisoryMutationFormSchema },
      ],
    },
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const isForm = parsed.mediaType === FORM_MEDIA_TYPE;
  id = parsedId.data;

  if (body.intent === "delete") {
    if (body.confirm !== "delete")
      return adminMutationProblem(
        "DELETION_CONFIRMATION_REQUIRED",
        "deletion confirmation required",
        400,
      );
    const deleted = await db
      .delete(advisoryApplications)
      .where(eq(advisoryApplications.id, id))
      .returning({ id: advisoryApplications.id });
    if (deleted.length === 0)
      return adminMutationProblem(
        "APPLICATION_NOT_FOUND",
        "application not found",
        404,
      );
    if (isForm)
      return NextResponse.redirect(
        new URL("/admin/advisory-applications", request.url),
        303,
      );
    return NextResponse.json({
      ok: true,
      id,
      deleted: true,
      reviewerId: auth.reviewerId,
    });
  }

  if (!isStatus(body.status)) {
    return adminMutationProblem("INVALID_STATUS", "invalid status", 400);
  }

  const updated = await db
    .update(advisoryApplications)
    .set({ status: body.status })
    .where(eq(advisoryApplications.id, id))
    .returning({ id: advisoryApplications.id });

  if (updated.length === 0) {
    return adminMutationProblem(
      "APPLICATION_NOT_FOUND",
      "application not found",
      404,
    );
  }

  if (isForm) {
    const redirect = safeInternalPathOr(
      body.redirect,
      "/admin/advisory-applications",
    );
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json({
    ok: true,
    id,
    status: body.status,
    reviewerId: auth.reviewerId,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAdminMutation(
    request,
    {
      route: "/api/admin/advisory-applications/[id]",
      action: "advisory_application.mutate",
      targetType: "advisory_application",
      targetId: id,
    },
    (auth) => mutateAdvisoryApplication(request, id, auth),
  );
}
