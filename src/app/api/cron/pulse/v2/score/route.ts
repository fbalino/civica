import { NextResponse } from "next/server";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import { getDb } from "@/lib/db";
import { corroborateEvents } from "@/lib/pulse/v2/corroborate";
import { calculateDimensionalDeltas } from "@/lib/pulse/v2/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);
  const db = getDb();
  const corroboration = await corroborateEvents(db, {
    dryRun,
    cronExecutionKey,
  });
  const scoring = await calculateDimensionalDeltas(db, {
    dryRun,
    cronExecutionKey,
  });
  return NextResponse.json({
    ok: true,
    step: "pulse.v2.score",
    dryRun,
    started,
    finished: new Date().toISOString(),
    summary: { corroboration, scoring },
  });
}

const cronHandler = withCronJob("pulse.v2.score", handler);

export { cronHandler as GET, cronHandler as POST };
