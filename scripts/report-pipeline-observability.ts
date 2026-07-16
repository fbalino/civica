import { CRON_JOB_DEFINITIONS } from "../src/lib/api/cron-job-registry";
import { latestCronScheduleSlot } from "../src/lib/api/cron-schedule";
import {
  loadPipelineAlertRows,
  pipelineAlerts,
} from "../src/lib/platform/pipeline-observability";

async function main() {
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
  console.log(
    JSON.stringify(
      {
        contract: "civica-pipeline-observability-report/v1",
        checkedAt: now.toISOString(),
        alertCount: alerts.length,
        alerts,
      },
      null,
      2,
    ),
  );
  if (alerts.length) process.exitCode = 1;
}

main().catch(() => {
  console.error("[pipeline-observability] report_failed");
  process.exit(1);
});
