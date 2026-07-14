import { NextResponse } from "next/server";
import {
  cronExecutionKeyFromRequest,
  withCronJob,
} from "@/lib/api/cron-job";
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
  try {
    const db = createDb();
    const summary = await ingestPulseV2(db, { dryRun, cronExecutionKey });
    const { httpStatus, ...outcome } = pulseV2IngestCronOutcome(summary);
    return NextResponse.json(
      {
        ...outcome,
        step: "pulse.v2.ingest",
        dryRun,
        started,
        finished: new Date().toISOString(),
        summary,
      },
      { status: httpStatus },
    );
  } catch (err) {
    console.error("[cron pulse.v2.ingest] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.ingest",
        dryRun,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("pulse.v2.ingest", handler);

export { cronHandler as GET, cronHandler as POST };
