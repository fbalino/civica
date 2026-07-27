import { readFileSync } from "node:fs";

import {
  PULSE_DRIFT_METRICS,
  PULSE_DRIFT_MONITOR_VERSION,
  PULSE_DRIFT_THRESHOLD_VERSION,
  PULSE_DRIFT_WINDOW_DAYS,
} from "../src/lib/pulse/v2/drift-monitor";

const LIVE = process.argv.includes("--live");
const unknown = process.argv.slice(2).filter((arg) => arg !== "--live");

function fail(message: string): never {
  throw new Error(`PUL-024 Pulse drift validation failed: ${message}`);
}

async function main(): Promise<void> {
  if (unknown.length) fail(`unknown argument(s): ${unknown.join(", ")}`);
  const migration = readFileSync(
    "drizzle/authoritative/0044_pulse_drift_monitoring.sql",
    "utf8",
  );
  const scoreRoute = readFileSync(
    "src/app/api/cron/pulse/v2/score/route.ts",
    "utf8",
  );
  const runbook = readFileSync("data/PULSE-DRIFT-MONITORING.md", "utf8");
  const required = [
    "pulse_drift_baselines",
    "pulse_drift_observations",
    "pulse_drift_alerts",
    "pulse_drift_baselines_append_only",
    "pulse_drift_observations_append_only",
    "pulse_drift_alerts_append_only",
    "pulse-drift-baseline/v1",
    "pulse-drift-observation/v1",
    "pulse-drift-alert/v1",
  ];
  for (const value of required) {
    if (!migration.includes(value)) fail(`migration is missing ${value}`);
  }
  if (!scoreRoute.includes("recordPulseDriftObservation")) {
    fail("completed score runs do not record a drift observation");
  }
  for (const metric of PULSE_DRIFT_METRICS) {
    if (!runbook.includes(`## ${metric.replaceAll("_", "-")}`)) {
      fail(`runbook is missing the ${metric} remediation section`);
    }
  }
  if (!runbook.includes("PUL-040") || !runbook.includes("PUL-018")) {
    fail("runbook does not preserve the prospective/evaluation boundary");
  }

  if (LIVE) {
    const { config } = await import("dotenv");
    config({ path: ".env.local", quiet: true });
    if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
    const { getDb } = await import("../src/lib/db");
    const { previewPulseDriftObservation } = await import(
      "../src/lib/pulse/v2/drift-monitor-store"
    );
    const preview = await previewPulseDriftObservation(getDb());
    console.log(
      `Live read-only preview: ${preview.standing}; ${preview.alertCount} alert(s); baseline ${preview.baselineId ?? "absent"}.`,
    );
  }

  console.log("=== PUL-024 Pulse drift monitoring ===\n");
  console.log(`Contract: ${PULSE_DRIFT_MONITOR_VERSION}`);
  console.log(`Threshold contract: ${PULSE_DRIFT_THRESHOLD_VERSION}`);
  console.log(`Trailing window: ${PULSE_DRIFT_WINDOW_DAYS} days`);
  console.log(`Metrics: ${PULSE_DRIFT_METRICS.join(", ")}`);
  console.log("PASS — immutable baseline/observation/alert contracts, score integration, and remediation coverage are closed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
