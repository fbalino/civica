import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { createDb, ingestPulseEvents } from "@/lib/pulse/ingest";

export const runtime = "nodejs";
// Vercel Cron hits this as GET; allow POST too for manual triggering.
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const db = createDb();
    const summary = await ingestPulseEvents(db, { hoursBack: 24 });
    return NextResponse.json({
      ok: true,
      step: "pulse.ingest",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.ingest] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.ingest",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
