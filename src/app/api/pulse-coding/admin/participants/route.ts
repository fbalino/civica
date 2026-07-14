import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withAdminMutation } from "@/lib/admin/mutation";
import type { AdminSession } from "@/lib/admin/session";
import { issuePulseCodingParticipant } from "@/lib/pulse/v2/coding-store";

const SLOTS = new Set(["coder_a", "coder_b", "adjudicator"]);
const ACTOR_TYPES = new Set(["qualified_human", "agent_dry_pilot"]);
const USE_STATUSES = new Set(["evaluation_candidate", "dry_run_not_gold"]);
const EXPECTED_ISSUANCE_ERRORS = new Set([
  "Agent participants are permanently non-gold",
  "Pulse coding study not found",
  "Pulse coding study has no packets",
]);

async function issueParticipant(
  request: NextRequest,
  admin: AdminSession,
  participantId: string,
) {
  const body = (await request.json()) as Record<string, unknown>;
  const studyId = String(body.studyId ?? "");
  const pseudonym = String(body.pseudonym ?? "").trim().slice(0, 80);
  const slot = String(body.slot ?? "");
  const actorType = String(body.actorType ?? "");
  const useStatus = String(body.useStatus ?? "");
  if (
    !/^[a-f0-9-]{36}$/.test(studyId) ||
    !/^[a-zA-Z0-9 _.-]{2,80}$/.test(pseudonym) ||
    !SLOTS.has(slot) ||
    !ACTOR_TYPES.has(actorType) ||
    !USE_STATUSES.has(useStatus)
  )
    return NextResponse.json({ error: "Invalid participant request" }, { status: 400 });
  if (actorType === "agent_dry_pilot" && useStatus !== "dry_run_not_gold")
    return NextResponse.json({ error: "Agent participants are permanently non-gold" }, { status: 400 });
  try {
    const result = await issuePulseCodingParticipant({
      actorId: admin.reviewerId,
      studyId,
      pseudonym,
      slot: slot as "coder_a" | "coder_b" | "adjudicator",
      actorType: actorType as "qualified_human" | "agent_dry_pilot",
      useStatus: useStatus as "evaluation_candidate" | "dry_run_not_gold",
      expiresAt: null,
      requestId: randomUUID(),
      participantId,
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !EXPECTED_ISSUANCE_ERRORS.has(error.message)
    ) {
      throw error;
    }
    return NextResponse.json(
      { error: error.message },
      { status: 409 },
    );
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
