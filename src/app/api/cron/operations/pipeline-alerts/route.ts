import { NextResponse } from "next/server";

import { withCronJob } from "@/lib/api/cron-job";
import { CRON_JOB_DEFINITIONS } from "@/lib/api/cron-job-registry";
import { latestCronScheduleSlot } from "@/lib/api/cron-schedule";
import {
  loadPipelineAlertRows,
  pipelineAlerts,
} from "@/lib/platform/pipeline-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler() {
  const now = new Date();
  const expectedSlots = new Map(
    CRON_JOB_DEFINITIONS.filter(
      (definition) => !definition.retired && definition.schedule,
    ).map((definition) => [
      definition.id,
      latestCronScheduleSlot(definition.schedule!, now),
    ]),
  );
  const alerts = pipelineAlerts({
    now,
    expectedSlots,
    rows: await loadPipelineAlertRows(now),
  });
  if (alerts.length) {
    // The durable detail is intentionally limited to registered pipeline IDs,
    // a closed alert type, and bounded counters. Vercel's cron log is the
    // owned operational channel until PLT-018 adds broader error routing.
    console.error(
      "[pipeline-alert] " +
        JSON.stringify(
          alerts.map(({ id, pipelineId }) => ({ id, pipelineId })),
        ),
    );
    return NextResponse.json(
      {
        ok: false,
        outcome: "pipeline_alerts_open",
        alertCount: alerts.length,
        alerts,
      },
      { status: 503 },
    );
  }
  return NextResponse.json({
    ok: true,
    step: "operations.pipeline-alerts",
    checkedAt: now.toISOString(),
    alertCount: 0,
  });
}

const cronHandler = withCronJob("operations.pipeline-alerts", handler);

export { cronHandler as GET, cronHandler as POST };
