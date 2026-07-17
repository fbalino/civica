import { NextResponse } from "next/server";

import { withCronJob } from "@/lib/api/cron-job";
import {
  checkHealthStatus,
  statusPageDecision,
} from "@/lib/platform/health-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Vercel Runtime Log is the owner-facing alert channel. This operation
 * remains successful when an incident is open so a healthy monitor does not
 * manufacture a second failed-pipeline alert. The documented two-observation
 * threshold is evaluated from consecutive log entries by the owner.
 */
async function handler() {
  const report = await checkHealthStatus();
  const decision = statusPageDecision(report);
  const adverseComponents = report.components
    .filter((component) => component.state !== "operational")
    .map(({ id, state, summary }) => ({ id, state, summary }));
  if (adverseComponents.length) {
    console.error(
      "[health-alert] " +
        JSON.stringify({
          overall: report.overall,
          adverseComponents,
          statusPageDecision: decision,
        }),
    );
  }
  return NextResponse.json({
    ok: true,
    step: "operations.health-alerts",
    checkedAt: report.checkedAt,
    overall: report.overall,
    alertCount: adverseComponents.length,
    alertsOpen: adverseComponents.length > 0,
    statusPageDecision: decision,
  });
}

const cronHandler = withCronJob("operations.health-alerts", handler);

export { cronHandler as GET, cronHandler as POST };
