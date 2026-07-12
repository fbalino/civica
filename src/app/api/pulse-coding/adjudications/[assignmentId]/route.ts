import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import { recordPulseCodingAdjudication } from "@/lib/pulse/v2/coding-store";
import type { PulseCodingAdjudicationInput } from "@/lib/pulse/v2/coding-workspace";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getPulseCodingSession();
  if (!session || session.kind !== "participant" || session.role !== "adjudicator")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { assignmentId } = await params;
  const body = (await request.json()) as Omit<
    PulseCodingAdjudicationInput,
    "schemaVersion" | "adjudicatorId" | "recordedAt"
  >;
  try {
    const result = await recordPulseCodingAdjudication({
      session,
      assignmentId,
      requestId: request.headers.get("x-idempotency-key") || randomUUID(),
      adjudication: body,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adjudication failed";
    return NextResponse.json({ error: message }, { status: /immutable|already/i.test(message) ? 409 : 400 });
  }
}
