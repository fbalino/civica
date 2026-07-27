import { NextResponse } from "next/server";
import { cronExecutionKeyFromRequest, withCronJob } from "@/lib/api/cron-job";
import { summarizeCronReports } from "@/lib/api/cron-output";
import { createDb, ingestPulseV2 } from "@/lib/pulse/v2/ingest";
import { pulseV2IngestCronOutcome } from "@/lib/pulse/v2/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Eight connectors in parallel; allow extra time.
export const maxDuration = 300;

async function handler(request: Request) {
  const started = new Date().toISOString();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const cronExecutionKey = cronExecutionKeyFromRequest(request);
  const db = createDb();
  const summary = await ingestPulseV2(db, { dryRun, cronExecutionKey });
  const outcome = pulseV2IngestCronOutcome(summary);
  const safeSummary = {
    ...summary,
    reports: summarizeCronReports(summary.reports),
  };
  return NextResponse.json(
    {
      ok: outcome.ok,
      outcome: outcome.outcome,
      failedConnectors: outcome.failedConnectors,
      step: "pulse.v2.ingest",
      dryRun,
      started,
      finished: new Date().toISOString(),
      summary: safeSummary,
    },
    { status: outcome.httpStatus },
  );
}

const cronHandler = withCronJob("pulse.v2.ingest", handler);

export { cronHandler as GET, cronHandler as POST };
