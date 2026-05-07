/**
 * v1.0 reconciliation verification suite — CLI driver.
 *
 * Thin wrapper around `runVerificationSuite()` from
 * `src/lib/factbook/reconcile/verify-reconciliation-v1.ts`. The same
 * library is consumed by the cron route at
 * `src/app/api/cron/factbook/verify-reconciliation/route.ts`, so the
 * CLI and the cron exercise the exact same code path.
 *
 * Usage:
 *
 *   npx tsx scripts/verify-reconciliation-v1.ts
 *   npx tsx scripts/verify-reconciliation-v1.ts --json
 *   npx tsx scripts/verify-reconciliation-v1.ts --metric=multi_sourced_two
 *   npx tsx scripts/verify-reconciliation-v1.ts --launch-phase=launched
 *
 * Exit codes:
 *   0 — overallStatus = pass or warn
 *   1 — overallStatus = fail (gating metric failed AND launchPhase is
 *       launched, since pre-launch failures soften to warn)
 *   2 — runtime error (DB unreachable, malformed flags, etc.)
 *
 * Adopted via: ~/civica/plan/v1-verification-suite-resolution-v1.md
 */
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import {
  runVerificationSuite,
  formatReport,
} from "@/lib/factbook/reconcile/verify-reconciliation-v1";

async function main() {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes("--json");
  const verbose = argv.includes("--verbose");

  const metricArg = argv.find((a) => a.startsWith("--metric="));
  const metricId = metricArg ? metricArg.split("=")[1] : undefined;

  const launchPhaseArg = argv.find((a) => a.startsWith("--launch-phase="));
  const launchPhaseValue = launchPhaseArg ? launchPhaseArg.split("=")[1] : undefined;
  if (
    launchPhaseValue !== undefined &&
    launchPhaseValue !== "pre-launch-beta" &&
    launchPhaseValue !== "launched"
  ) {
    console.error(
      `--launch-phase must be 'pre-launch-beta' or 'launched' (got '${launchPhaseValue}')`,
    );
    process.exit(2);
  }
  const launchPhase = launchPhaseValue as
    | "pre-launch-beta"
    | "launched"
    | undefined;

  const report = await runVerificationSuite(db, {
    verbose,
    metricId,
    launchPhase,
  });

  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  if (report.overallStatus === "fail") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-reconciliation-v1] CLI failed:", err);
  process.exit(2);
});
