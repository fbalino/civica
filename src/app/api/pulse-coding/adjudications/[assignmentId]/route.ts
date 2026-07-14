import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { recordPulseCodingAdjudication } from "@/lib/pulse/v2/coding-store";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
  requestInputErrorResponse,
} from "@/lib/api/request-body";
import {
  optionalIdempotencyKeySchema,
  pulseCodingAdjudicationBodySchema,
  REQUEST_BODY_LIMITS,
  requestUuidSchema,
  type PulseCodingAdjudicationBody,
} from "@/lib/api/request-body-schemas";
import { apiProblem, withSafeJsonErrors } from "@/lib/api/problem-response";
import { pulseCodingProblem } from "@/lib/api/pulse-coding-problem";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  return withSafeJsonErrors(
    "api/pulse-coding/adjudications/[assignmentId]",
    async () => {
      const session = await getPulseCodingSession();
      if (
        !session ||
        session.kind !== "participant" ||
        session.role !== "adjudicator"
      )
        return apiProblem("UNAUTHORIZED");
      const routeParams = await params;
      const parsedAssignmentId = requestUuidSchema.safeParse(
        routeParams.assignmentId,
      );
      if (!parsedAssignmentId.success)
        return requestInputErrorResponse("INVALID_REQUEST");
      const parsedRequestId = optionalIdempotencyKeySchema.safeParse(
        request.headers.get("x-idempotency-key"),
      );
      if (!parsedRequestId.success)
        return requestInputErrorResponse("INVALID_REQUEST");
      const parsed = await parseBoundedRequestBody<PulseCodingAdjudicationBody>(
        request,
        {
          maxBytes: REQUEST_BODY_LIMITS.pulseCodingAdjudication,
          media: [
            {
              mediaType: JSON_MEDIA_TYPE,
              schema: pulseCodingAdjudicationBodySchema,
            },
          ],
        },
      );
      if (!parsed.ok) return parsed.response;
      try {
        const result = await recordPulseCodingAdjudication({
          session,
          assignmentId: parsedAssignmentId.data,
          requestId: parsedRequestId.data ?? randomUUID(),
          adjudication: parsed.data,
        });
        return NextResponse.json(result, {
          headers: { "cache-control": "no-store" },
        });
      } catch (error) {
        return pulseCodingProblem("pulse-coding/adjudication", error);
      }
    },
  );
}
