import { readFileSync } from "node:fs";

import {
  buildPulseSourceCoverageAudit,
  pulseSourceCoverageAuditErrors,
  type PulseSourceCoverageAudit,
} from "../src/lib/pulse/v2/source-coverage-audit";

const CHECKED_PATH =
  "plan/evidence/PUL-040/source-coverage-audit-2026-08-17.json";
const LIVE = process.argv.includes("--live");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--live");

function fail(errors: readonly string[]): never {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }
  throw new Error(
    `Pulse source-coverage validation failed with ${errors.length} problem(s).`,
  );
}

function describe(label: string, audit: PulseSourceCoverageAudit): string {
  const { operating, degraded, inactive } = audit.report.summary;
  return `${label}: ${operating} operating, ${degraded} degraded, ${inactive} inactive`;
}

async function main(): Promise<void> {
  if (unknownArgs.length > 0) {
    fail([`unknown argument(s): ${unknownArgs.join(", ")}`]);
  }

  const checked = JSON.parse(readFileSync(CHECKED_PATH, "utf8")) as unknown;
  const checkedErrors = pulseSourceCoverageAuditErrors(checked);
  if (checkedErrors.length > 0) fail(checkedErrors);
  const checkedAudit = checked as PulseSourceCoverageAudit;

  if (!LIVE) {
    console.log(
      `PASS — checked dated ${describe("Pulse source coverage", checkedAudit)}; ` +
        `runtime, telemetry, evidence scope, exact rights posture, and blind spots reconcile without Neon.`,
    );
    console.log(
      "NOTICE — this is historical acceptance evidence, not current operating state; run the explicit :live audit for Neon telemetry.",
    );
    return;
  }

  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  const { loadPulseSourceCoverageReport } =
    await import("../src/lib/pulse/v2/source-coverage");
  const liveAudit = buildPulseSourceCoverageAudit(
    await loadPulseSourceCoverageReport(),
  );
  const liveErrors = pulseSourceCoverageAuditErrors(liveAudit);
  if (liveErrors.length > 0) fail(liveErrors);

  console.log(
    `PASS — read-only ${describe("live Pulse source coverage", liveAudit)}; ` +
      "current telemetry is valid and may legitimately differ from the dated checked artifact.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
