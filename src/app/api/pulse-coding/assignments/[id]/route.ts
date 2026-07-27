import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import {
  lockPulseCodingSubmission,
  savePulseCodingDraft,
} from "@/lib/pulse/v2/coding-store";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  optionalIdempotencyKeySchema,
  pulseCodingAssignmentBodySchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type PulseCodingAssignmentBody,
} from "@/lib/api/request-body-schemas";
import { apiProblem, withPrivateSafeJsonErrors } from "@/lib/api/problem-response";
import { pulseCodingProblem } from "@/lib/api/pulse-coding-problem";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withPrivateSafeJsonErrors("api/pulse-coding/assignments/[id]", async () => {
    const session = await getPulseCodingSession();
    if (!session || session.kind !== "participant")
      return apiProblem("UNAUTHORIZED");
    const routeParams = await params;
    const parsedAssignmentId = requestUuidSchema.safeParse(routeParams.id);
    if (!parsedAssignmentId.success)
      return requestInputErrorResponse("INVALID_REQUEST");
    const parsedRequestId = optionalIdempotencyKeySchema.safeParse(
      request.headers.get("x-idempotency-key"),
    );
    if (!parsedRequestId.success)
      return requestInputErrorResponse("INVALID_REQUEST");
    const parsed = await parseBoundedRequestBody<PulseCodingAssignmentBody>(
      request,
      {
        maxBytes: REQUEST_BODY_LIMITS.pulseCodingDraft,
        media: [
          {
            mediaType: JSON_MEDIA_TYPE,
            schema: pulseCodingAssignmentBodySchema,
          },
        ],
      },
    );
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const requestId = parsedRequestId.data ?? randomUUID();
    try {
      const result =
        body.action === "lock"
          ? await lockPulseCodingSubmission({
              session,
              assignmentId: parsedAssignmentId.data,
              requestId,
              draft: body.draft,
            })
          : await savePulseCodingDraft({
              session,
              assignmentId: parsedAssignmentId.data,
              requestId,
              draft: body.draft,
            });
      return NextResponse.json(result, {
        headers: { "cache-control": "no-store" },
      });
    } catch (error) {
      return pulseCodingProblem("pulse-coding/assignment", error);
    }
  });
}
