import { NextResponse } from "next/server";

import { withCronJob } from "@/lib/api/cron-job";
import {
  alertSignature,
  cronAlertTransition,
  postgresCronAlertHistoryStore,
} from "@/lib/api/cron-alert-transition";
import { CRON_JOB_DEFINITIONS } from "@/lib/api/cron-job-registry";
import { latestCronScheduleSlot } from "@/lib/api/cron-schedule";
import {
  loadPipelineAlertRows,
  pipelineAlerts,
} from "@/lib/platform/pipeline-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONITOR_PIPELINE_ID = "operations.pipeline-alerts";

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
    // The monitor reports pipeline health; it cannot recursively make its own
    // last alert response a new pipeline-health finding.
    ignoredPipelineIds: new Set([MONITOR_PIPELINE_ID]),
  });
  const transition = cronAlertTransition({
    namespace: "pipeline",
    now,
    currentSignature: alerts.length
      ? alertSignature(
          alerts.map(({ id, pipelineId }) => `${pipelineId}:${id}`),
        )
      : null,
    requiredConsecutive: 1,
    reminderCooldownMs: 72 * 60 * 60 * 1_000,
    history: await postgresCronAlertHistoryStore.load(MONITOR_PIPELINE_ID),
  });
  if (alerts.length) {
    // The durable detail is intentionally limited to registered pipeline IDs,
    // a closed alert type, and bounded counters. Vercel's cron log is the
    // owned operational channel until PLT-018 adds broader error routing.
    if (
      transition.emission === "open" ||
      transition.emission === "reminder"
    ) {
      console.error(
        "[pipeline-alert] " +
          JSON.stringify({
            transition: transition.emission,
            alerts: alerts.map(({ id, pipelineId }) => ({ id, pipelineId })),
          }),
      );
    }
    return NextResponse.json(
      {
        ok: false,
        outcome: transition.resultCode,
        alertCount: alerts.length,
        alertTransition: transition.state,
        alerts,
      },
      { status: 503 },
    );
  }
  if (transition.emission === "recovered") {
    console.info(
      "[pipeline-alert] " + JSON.stringify({ transition: "recovered" }),
    );
  }
  return NextResponse.json({
    ok: true,
    step: "operations.pipeline-alerts",
    outcome: transition.resultCode,
    checkedAt: now.toISOString(),
    alertCount: 0,
    alertTransition: transition.state,
  });
}

const cronHandler = withCronJob("operations.pipeline-alerts", handler);

export { cronHandler as GET, cronHandler as POST };
