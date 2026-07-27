import { NextResponse } from "next/server";

import { withCronJob } from "@/lib/api/cron-job";
import {
  errorMonitoringAlerts,
  loadErrorMonitoringAlerts,
} from "@/lib/platform/error-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Runtime Logs are the named, project-owned alert channel. This route
 * succeeds after emitting an alert so an already-open error cannot cause the
 * alerting job to report itself as a new failed pipeline on every run.
 */
async function handler() {
  const now = new Date();
  const alerts = errorMonitoringAlerts(await loadErrorMonitoringAlerts(now));
  if (alerts.length) {
    console.error("[error-monitoring-alert] " + JSON.stringify(alerts));
  }
  return NextResponse.json({
    ok: true,
    step: "operations.error-alerts",
    checkedAt: now.toISOString(),
    alertCount: alerts.length,
    alertsOpen: alerts.length > 0,
  });
}

const cronHandler = withCronJob("operations.error-alerts", handler);

export { cronHandler as GET, cronHandler as POST };
