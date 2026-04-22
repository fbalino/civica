import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import { createDb, calculatePulseScores } from "@/lib/pulse/calculate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const started = new Date().toISOString();
  try {
    const db = createDb();
    const summary = await calculatePulseScores(db);
    return NextResponse.json({
      ok: true,
      step: "pulse.calculate",
      started,
      finished: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    console.error("[cron pulse.calculate] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.calculate",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
