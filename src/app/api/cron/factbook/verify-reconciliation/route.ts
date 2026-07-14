/**
 * v1.0 follow-up §1.1 — nightly verification cron.
 *
 * Runs daily at 03:45 UTC (per `vercel.json`). Authenticated via
 * the shared cron boundary against `CRON_SECRET`. Idempotent: pure read-only
 * suite, no DB writes.
 *
 * The cron's job is drift detection. It hits ~14 metric queries
 * against the live DB, decides per-metric pass/warn/fail using
 * `runVerificationSuite()`, and calls `notifyAdmin(report)` if any
 * metric is non-pass.
 *
 * Pre-launch posture: while `launchPhase === "pre-launch-beta"`, gating
 * failures soften to `warn`. The route still calls `notifyAdmin`
 * so log-only readers see the issue, but `overallStatus` won't be
 * `fail` until launch.
 *
 * Email transport gap: v1.0 ships with no transactional email
 * configured (verified: contact-form route notes "no transactional
 * email provider configured"; Pulse alerts use console-only logging).
 * `notifyAdmin` v1.0 emits a structured one-line summary plus the
 * full JSON report to console.error. The Vercel logs surface this in
 * the deploy view. v1.x follow-up wires real email transport here.
 *
 * Diagnostic overrides:
 *   - `?dryRun=1`     — runs the suite but skips `notifyAdmin`.
 *   - `?verbose=1`    — includes per-source detail in the response.
 *   - `?metric=<id>`  — restricts to one metric (smoke testing).
 *
 * Methodology: ~/civica/plan/v1-verification-suite-resolution-v1.md
 */
import { NextResponse } from "next/server";
import { withCronJob } from "@/lib/api/cron-job";
import { db } from "@/lib/db";
import { reconciliationVerificationCronOutcome } from "@/lib/factbook/cron-outcomes";
import {
  runVerificationSuite,
  formatReport,
  type VerificationReport,
} from "@/lib/factbook/reconcile/verify-reconciliation-v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 14 single-table queries, all indexed; probe runs in <2s. 60s
// headroom for transient network blips on the Neon serverless side.
export const maxDuration = 60;

/**
 * Stub admin alert path. v1.0 emits a structured log; v1.x swaps in
 * real email transport. Centralised here so the cron handler and any
 * future surfaces (admin dashboard, status page) share one notify
 * contract.
 */
function notifyAdmin(report: VerificationReport): void {
  // One-line summary for log-grepping.
  const offenders = report.metrics
    .filter((m) => m.status !== "pass")
    .map((m) => `${m.id}=${m.status}`)
    .join(", ");
  console.error(
    `[verify-reconciliation] alert overallStatus=${report.overallStatus} ` +
      `pass/warn/fail=${report.passCount}/${report.warnCount}/${report.failCount} ` +
      `offenders=[${offenders}]`,
  );
  // Full JSON for downstream parsers / future log shippers.
  console.error("[verify-reconciliation] full report:", JSON.stringify(report));
}

async function handler(request: Request) {
  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const verbose = url.searchParams.get("verbose") === "1";
  const metricId = url.searchParams.get("metric") ?? undefined;

  try {
    const report = await runVerificationSuite(db, { verbose, metricId });

    // Always log the full plain-text report so operators can grep
    // Vercel logs without parsing JSON. The report header includes
    // overallStatus + pass/warn/fail counts in one block.
    console.log(formatReport(report));

    // Alert path: anything other than `pass` → notify. Skip on dryRun.
    if (report.overallStatus !== "pass" && !dryRun) {
      notifyAdmin(report);
    }

    const outcome = reconciliationVerificationCronOutcome(report);

    return NextResponse.json(
      {
        ok: outcome.ok,
        outcome: outcome.outcome,
        healthOk: outcome.healthOk,
        step: "factbook.verify-reconciliation",
        started: startedAt,
        finished: new Date().toISOString(),
        dryRun,
        report,
      },
      { status: outcome.httpStatus },
    );
  } catch (err) {
    console.error("[cron factbook.verify-reconciliation] failed:", err);
    return NextResponse.json(
      {
        ok: false,
        step: "factbook.verify-reconciliation",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

const cronHandler = withCronJob("factbook.verify-reconciliation", handler);

export { cronHandler as GET, cronHandler as POST };
