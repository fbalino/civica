import { NextResponse } from "next/server";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import { getDb } from "@/lib/db";
import { runClustering } from "@/lib/pulse/v2/cluster";
import { pulseV2ClusterCronOutcome } from "@/lib/pulse/v2/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// First invocation downloads and loads the multilingual MiniLM model.
// Subsequent calls reuse the cached pipeline; allow extra time for cold start.
export const maxDuration = 300;

async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);
  const db = getDb();
  const summary = await runClustering(db, {
    limit: 1000,
    dryRun,
    cronExecutionKey,
  });
  const outcome = pulseV2ClusterCronOutcome(summary);
  return NextResponse.json(
    {
      ok: outcome.ok,
      outcome: outcome.outcome,
      step: "pulse.v2.cluster",
      dryRun,
      started,
      finished: new Date().toISOString(),
      summary,
    },
    { status: outcome.httpStatus },
  );
}

const cronHandler = withCronJob("pulse.v2.cluster", handler);

export { cronHandler as GET, cronHandler as POST };
