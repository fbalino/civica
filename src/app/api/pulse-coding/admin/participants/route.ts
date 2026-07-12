import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { issuePulseCodingParticipant } from "@/lib/pulse/v2/coding-store";

const SLOTS = new Set(["coder_a", "coder_b", "adjudicator"]);
const ACTOR_TYPES = new Set(["qualified_human", "agent_dry_pilot"]);
const USE_STATUSES = new Set(["evaluation_candidate", "dry_run_not_gold"]);

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Access could not be issued" },
      { status: 409 },
    );
  }
}
