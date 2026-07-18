import { NextResponse } from "next/server";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import { getDb } from "@/lib/db";
import { corroborateEvents } from "@/lib/pulse/v2/corroborate";
import {
  previewPulseDriftObservation,
  recordPulseDriftObservation,
} from "@/lib/pulse/v2/drift-monitor-store";
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
  const drift = dryRun
    ? await previewPulseDriftObservation(db)
    : await recordPulseDriftObservation(db, { scoreRunId: scoring.runId });
  if (drift.alertCount > 0) {
    // The durable alert rows contain bounded affected-row references. The
    // operational log stays smaller and never repeats source evidence.
    console.error(
      "[pulse.drift-alert] " +
        JSON.stringify({
          scoreRunId: scoring.runId,
          standing: drift.standing,
          metrics: drift.alerts.map((alert) => alert.metric),
        }),
    );
  }
  return NextResponse.json({
    ok: true,
    step: "pulse.v2.score",
    dryRun,
    started,
    finished: new Date().toISOString(),
    summary: {
      corroboration,
      scoring,
      drift: {
        standing: drift.standing,
        alertCount: drift.alertCount,
        baselineId: drift.baselineId,
        observationId: drift.observationId,
        reused: drift.reused,
      },
    },
  });
}

const cronHandler = withCronJob("pulse.v2.score", handler);

export { cronHandler as GET, cronHandler as POST };
