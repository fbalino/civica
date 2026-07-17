import {
  errorMonitoringAlerts,
  loadErrorMonitoringAlerts,
} from "../src/lib/platform/error-monitoring";

async function main() {
  const now = new Date();
  const alerts = errorMonitoringAlerts(await loadErrorMonitoringAlerts(now));
  console.log(
    JSON.stringify(
      {
        contract: "civica-error-monitoring-report/v1",
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
  console.error("[error-monitoring] report_failed");
  process.exit(1);
});
