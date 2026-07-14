import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import {
  loadPulseReviewSlaReport,
  recordDuePulseReviewEscalations,
} from "@/lib/pulse/v2/review-sla-store";
import { pulseV2ReviewSlaCronOutcome } from "@/lib/pulse/v2/cron-outcomes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const now = new Date();
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const alertsRecorded = dryRun
    ? 0
    : await recordDuePulseReviewEscalations(now);
  const report = await loadPulseReviewSlaReport(now);
  const outcome = pulseV2ReviewSlaCronOutcome(report);
  if (!outcome.healthOk) {
    console.error(
      "[pulse.review-sla] alert",
      JSON.stringify({ alertsRecorded, report }),
    );
  }
  return NextResponse.json(
    {
      ok: outcome.ok,
      outcome: outcome.outcome,
      healthOk: outcome.healthOk,
      step: "pulse.v2.review-sla",
      dryRun,
      alertsRecorded,
      report,
    },
    { status: outcome.httpStatus },
  );
}

const cronHandler = withCronJob("pulse.v2.review-sla", handler);

export { cronHandler as GET, cronHandler as POST };
