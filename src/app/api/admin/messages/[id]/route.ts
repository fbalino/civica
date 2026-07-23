/**
 * Contact-message status mutation.
 *
 * POST /api/admin/messages/[id]
 *
 * Form body or JSON:
 *   intent     'status' | 'delete'            (status is the default)
 *   status     'new' | 'read' | 'archived'    (required for status)
 *   confirm    'delete'                        (required for delete)
 *   redirect   post-success redirect path      (default: messages queue)
 *
 * Flips a contact submission's triage status so the Messages queue's filter
 * chips (New / Read / Archived) reflect reality. This is the smallest honest
 * mutation for the read-only Messages surface — the public contact POST never
 * sets `status` (defaults to 'new'); only this authed route changes it.
 *
 * Auth: the admin session cookie set by /api/admin/session (sign in at
 * /admin/sign-in) — the same session-only gate as
 * `/api/admin/advisory-applications/[id]` and `/api/admin/data-disputes/[id]`.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactSubmissions } from "@/lib/db/schema";
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
  adminMessageStatusFormSchema,
  adminMessageStatusBodySchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type AdminMessageStatusBody,
} from "@/lib/api/request-body-schemas";

const VALID_STATUSES = ["new", "read", "archived"] as const;
type Status = (typeof VALID_STATUSES)[number];

function isStatus(value: unknown): value is Status {
  return (
    typeof value === "string" &&
    (VALID_STATUSES as readonly string[]).includes(value)
  );
}

async function mutateMessage(
  request: NextRequest,
  id: string,
  auth: AdminSession,
) {
  const parsedId = requestUuidSchema.safeParse(id);
  if (!parsedId.success) return requestInputErrorResponse("INVALID_REQUEST");

  const parsed = await parseBoundedRequestBody<AdminMessageStatusBody>(
    request,
    {
      maxBytes: REQUEST_BODY_LIMITS.adminMessageStatus,
      media: [
        { mediaType: JSON_MEDIA_TYPE, schema: adminMessageStatusBodySchema },
        { mediaType: FORM_MEDIA_TYPE, schema: adminMessageStatusFormSchema },
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
      .delete(contactSubmissions)
      .where(eq(contactSubmissions.id, id))
      .returning({ id: contactSubmissions.id });
    if (deleted.length === 0)
      return adminMutationProblem("MESSAGE_NOT_FOUND", "message not found", 404);
    if (isForm)
      return NextResponse.redirect(new URL("/admin/messages", request.url), 303);
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
    .update(contactSubmissions)
    .set({ status: body.status })
    .where(eq(contactSubmissions.id, id))
    .returning({ id: contactSubmissions.id });

  if (updated.length === 0) {
    return adminMutationProblem("MESSAGE_NOT_FOUND", "message not found", 404);
  }

  if (isForm) {
    const redirect = safeInternalPathOr(body.redirect, "/admin/messages");
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
      route: "/api/admin/messages/[id]",
      action: "contact_submission.mutate",
      targetType: "contact_submission",
      targetId: id,
    },
    (auth) => mutateMessage(request, id, auth),
  );
}
