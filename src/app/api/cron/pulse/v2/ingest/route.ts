import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { createDb, ingestPulseV2 } from "@/lib/pulse/v2/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Eight connectors in parallel; allow extra time.
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const db = createDb();
    const summary = await ingestPulseV2(db);
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.ingest",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.v2.ingest] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.ingest",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
