import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { createDb, classifyPulseEvents } from "@/lib/pulse/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The LLM classifier runs per-event; allow extra time.
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const db = createDb();
    const summary = await classifyPulseEvents(db, { batchSize: 20, batchDelayMs: 1000 });
    return NextResponse.json({
      ok: true,
      step: "pulse.classify",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.classify] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.classify",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
