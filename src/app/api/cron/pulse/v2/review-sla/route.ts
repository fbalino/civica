import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/api/cron-auth";
import {
  loadPulseReviewSlaReport,
  recordDuePulseReviewEscalations,
} from "@/lib/pulse/v2/review-sla-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  const now = new Date();
  try {
    const alertsRecorded = await recordDuePulseReviewEscalations(now);
    const report = await loadPulseReviewSlaReport(now);
    if (
      report.breachedUnexcepted > 0 ||
      report.breachedExcepted > 0 ||
      report.escalationDue > 0
    ) {
      console.error(
        "[pulse.review-sla] alert",
        JSON.stringify({ alertsRecorded, report }),
      );
    }
    return NextResponse.json({
      ok: true,
      step: "pulse.v2.review-sla",
      alertsRecorded,
      report,
    });
  } catch (error) {
    console.error("[pulse.review-sla] failed", error);
    return NextResponse.json(
      {
        ok: false,
        step: "pulse.v2.review-sla",
        reviewHealth: "not_assessable",
        dailyCompletenessEligible: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as POST };
