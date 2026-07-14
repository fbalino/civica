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
  try {
    const alertsRecorded = dryRun
      ? 0
      : await recordDuePulseReviewEscalations(now);
    const report = await loadPulseReviewSlaReport(now);
    const { httpStatus, ...outcome } = pulseV2ReviewSlaCronOutcome(report);
    if (!outcome.healthOk) {
      console.error(
        "[pulse.review-sla] alert",
        JSON.stringify({ alertsRecorded, report }),
      );
    }
    return NextResponse.json(
      {
        ...outcome,
        step: "pulse.v2.review-sla",
        dryRun,
        alertsRecorded,
        report,
      },
      { status: httpStatus },
    );
  } catch (error) {
    console.error("[pulse.review-sla] failed", error);
    return NextResponse.json(
      {
        ok: false,
        outcome: "failed",
        healthOk: false,
        step: "pulse.v2.review-sla",
        dryRun,
        reviewHealth: "not_assessable",
        dailyCompletenessEligible: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("pulse.v2.review-sla", handler);

export { cronHandler as GET, cronHandler as POST };
