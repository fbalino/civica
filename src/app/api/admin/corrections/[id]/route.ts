import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

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
  adminCorrectionMutationBodySchema,
  adminCorrectionMutationFormSchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type AdminCorrectionMutationBody,
} from "@/lib/api/request-body-schemas";
import {
  correctionTriageErrors,
  isTerminalCorrectionStatus,
} from "@/lib/corrections/data-error-report";
import { isAtlasCorrectionSchemaReady } from "@/lib/corrections/schema-readiness";
import { db } from "@/lib/db";
import {
  atlasEntityChangeHistory,
  correctionLog,
} from "@/lib/db/schema";

async function mutateCorrection(
  request: NextRequest,
  id: string,
  auth: AdminSession,
) {
  const parsedId = requestUuidSchema.safeParse(id);
  if (!parsedId.success) return requestInputErrorResponse("INVALID_REQUEST");
  if (!(await isAtlasCorrectionSchemaReady())) {
    return adminMutationProblem(
      "CORRECTION_SCHEMA_PENDING",
      "Atlas correction triage is unavailable until the authoritative migration is applied",
      503,
    );
  }

  const parsed = await parseBoundedRequestBody<AdminCorrectionMutationBody>(
    request,
    {
      maxBytes: REQUEST_BODY_LIMITS.adminCorrectionMutation,
      media: [
        { mediaType: JSON_MEDIA_TYPE, schema: adminCorrectionMutationBodySchema },
        { mediaType: FORM_MEDIA_TYPE, schema: adminCorrectionMutationFormSchema },
      ],
    },
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  id = parsedId.data;

  const correctionRows = await db
    .select({ id: correctionLog.id, category: correctionLog.category })
    .from(correctionLog)
    .where(
      and(
        eq(correctionLog.id, id),
        eq(correctionLog.category, "atlas_data_error"),
      ),
    )
    .limit(1);
  if (!correctionRows[0]) {
    return adminMutationProblem(
      "CORRECTION_NOT_FOUND",
      "Atlas data report not found",
      404,
    );
  }

  const linkedRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(atlasEntityChangeHistory)
    .where(eq(atlasEntityChangeHistory.correctionLogId, id));
  const linkedChangeCount = linkedRows[0]?.count ?? 0;
  const disposition = body.disposition?.trim() || null;
  const errors = correctionTriageErrors({
    status: body.status,
    disposition,
    linkedChangeCount,
  });
  if (errors.length) {
    return adminMutationProblem(
      "INVALID_CORRECTION_TRANSITION",
      errors.join("; "),
      409,
    );
  }

  const now = new Date();
  const terminal = isTerminalCorrectionStatus(body.status);
  const updated = await db
    .update(correctionLog)
    .set({
      status: body.status,
      disposition,
      internalNotes: body.internalNotes?.trim() || null,
      triagedAt: now,
      reviewerId: auth.reviewerId,
      resolvedAt: terminal ? now : null,
      ...(body.redactSubmitter
        ? {
            submitterName: null,
            submitterEmail: null,
            submitterAffiliation: null,
          }
        : {}),
    })
    .where(eq(correctionLog.id, id))
    .returning({ id: correctionLog.id });
  if (!updated[0]) {
    return adminMutationProblem(
      "CORRECTION_NOT_FOUND",
      "Atlas data report not found",
      404,
    );
  }

  if (parsed.mediaType === FORM_MEDIA_TYPE) {
    const redirect = safeInternalPathOr(
      body.redirect,
      `/admin/corrections/${id}`,
    );
    return NextResponse.redirect(new URL(redirect, request.url), 303);
  }
  return NextResponse.json(
    {
      ok: true,
      id,
      status: body.status,
      linkedChangeCount,
      reviewerId: auth.reviewerId,
    },
    { headers: { "Cache-Control": "no-store" } },
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
      route: "/api/admin/corrections/[id]",
      action: "atlas_correction.triage",
      targetType: "atlas_correction",
      targetId: id,
    },
    (auth) => mutateCorrection(request, id, auth),
  );
}
