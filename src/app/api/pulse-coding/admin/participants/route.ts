import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  adminMutationProblem,
  withAdminMutation,
  type AdminMutationProblemCode,
} from "@/lib/admin/mutation";
import type { AdminSession } from "@/lib/admin/session";
import { issuePulseCodingParticipant } from "@/lib/pulse/v2/coding-store";
import {
  JSON_MEDIA_TYPE,
  parseBoundedRequestBody,
} from "@/lib/api/request-body";
import {
  pulseCodingParticipantBodySchema,
  REQUEST_BODY_LIMITS,
  type PulseCodingParticipantBody,
} from "@/lib/api/request-body-schemas";

const EXPECTED_ISSUANCE_PROBLEMS: ReadonlyMap<
  string,
  { error: string; code: AdminMutationProblemCode }
> = new Map([
  [
    "Agent participants are permanently non-gold",
    {
      error: "Agent participants are permanently non-gold.",
      code: "AGENT_USE_STATUS_INVALID",
    },
  ],
  [
    "Pulse coding study not found",
    { error: "Pulse coding study not found.", code: "STUDY_NOT_FOUND" },
  ],
  [
    "Pulse coding study has no packets",
    { error: "Pulse coding study has no packets.", code: "STUDY_EMPTY" },
  ],
]);

async function issueParticipant(
  request: NextRequest,
  admin: AdminSession,
  participantId: string,
) {
  const parsed = await parseBoundedRequestBody<PulseCodingParticipantBody>(
    request,
    {
      maxBytes: REQUEST_BODY_LIMITS.pulseParticipant,
      media: [
        {
          mediaType: JSON_MEDIA_TYPE,
          schema: pulseCodingParticipantBodySchema,
        },
      ],
    },
  );
  if (!parsed.ok) return parsed.response;
  const { studyId, slot, actorType, useStatus } = parsed.data;
  const pseudonym = parsed.data.pseudonym.trim();
  if (!/^[a-zA-Z0-9 _.-]{2,80}$/.test(pseudonym))
    return adminMutationProblem(
      "INVALID_PARTICIPANT_REQUEST",
      "Invalid participant request",
      400,
    );
  if (actorType === "agent_dry_pilot" && useStatus !== "dry_run_not_gold")
    return adminMutationProblem(
      "AGENT_USE_STATUS_INVALID",
      "Agent participants are permanently non-gold",
      400,
    );
  try {
    const result = await issuePulseCodingParticipant({
      actorId: admin.reviewerId,
      studyId,
      pseudonym,
      slot,
      actorType,
      useStatus,
      expiresAt: null,
      requestId: randomUUID(),
      participantId,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const problem =
      error instanceof Error
        ? EXPECTED_ISSUANCE_PROBLEMS.get(error.message)
        : undefined;
    if (!problem) throw error;
    return adminMutationProblem(problem.code, problem.error, 409);
  }
}

export async function POST(request: NextRequest) {
  const participantId = randomUUID();
  return withAdminMutation(
    request,
    {
      route: "/api/pulse-coding/admin/participants",
      action: "pulse_coding_participant.issue",
      targetType: "pulse_coding_participant",
      targetId: participantId,
    },
    (admin) => issueParticipant(request, admin, participantId),
  );
}
