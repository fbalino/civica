import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPulseCodingSession } from "@/lib/pulse/v2/coding-session";
import {
  lockPulseCodingSubmission,
  savePulseCodingDraft,
  type PulseCodingDraftInput,
} from "@/lib/pulse/v2/coding-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPulseCodingSession();
  if (!session || session.kind !== "participant")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json()) as {
    action?: string;
    draft?: PulseCodingDraftInput;
  };
  if (!body.draft || !["save", "lock"].includes(body.action ?? ""))
    return NextResponse.json({ error: "Invalid coding request" }, { status: 400 });
  const requestId = request.headers.get("x-idempotency-key") || randomUUID();
  try {
    const result =
      body.action === "lock"
        ? await lockPulseCodingSubmission({
            session,
            assignmentId: id,
            requestId,
            draft: body.draft,
          })
        : await savePulseCodingDraft({
            session,
            assignmentId: id,
            requestId,
            draft: body.draft,
          });
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Coding request failed";
    const conflict = /locked|race|immutable|duplicate/i.test(message);
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
  }
}
