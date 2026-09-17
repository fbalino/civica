import { NextResponse } from "next/server";

import { withCronJob } from "@/lib/api/cron-job";
import { dispatchDueCronRecoveries } from "@/lib/api/cron-recovery";
import {
  alertSignature,
  cronAlertTransition,
  postgresCronAlertHistoryStore,
} from "@/lib/api/cron-alert-transition";
import {
  checkHealthStatus,
  statusPageDecision,
} from "@/lib/platform/health-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/**
 * The Vercel Runtime Log is the owner-facing alert channel. The durable cron
 * ledger evaluates persistence and suppresses unchanged incidents between
 * reminders; the owner does not have to compare consecutive log entries.
 */
async function handler() {
  const report = await checkHealthStatus();
  const adverseComponents = report.components
    .filter((component) => component.state !== "operational")
    .map(({ id, state, summary }) => ({ id, state, summary }));
  const signature = adverseComponents.length
    ? alertSignature(
        adverseComponents.map(
          ({ id, state, summary }) => `${id}:${state}:${summary}`,
        ),
      )
    : null;
  const immediate = adverseComponents.some(
    ({ id, state }) =>
      (id === "application" || id === "database") && state === "unavailable",
  );
  const now = new Date(report.checkedAt);
  let recovery;
  try {
    recovery = await dispatchDueCronRecoveries({ now });
  } catch {
    console.error("[scheduled-recovery] control_unavailable");
    return NextResponse.json(
      {
        ok: false,
        step: "operations.health-alerts",
        outcome: "recovery_control_unavailable",
        checkedAt: report.checkedAt,
        overall: report.overall,
        alertCount: adverseComponents.length,
        alertsOpen: adverseComponents.length > 0,
      },
      { status: 503 },
    );
  }
  const transition = cronAlertTransition({
    namespace: "health",
    now,
    currentSignature: signature,
    immediate,
    requiredConsecutive: 2,
    reminderCooldownMs: 24 * 60 * 60 * 1_000,
    history: await postgresCronAlertHistoryStore.load("operations.health-alerts"),
  });
  const decision = statusPageDecision(
    report,
    transition.consecutiveAdverseObservations,
  );
  const recoveryTransportAvailable = recovery.transportFailed === 0;
  if (!recoveryTransportAvailable) {
    console.error(
      "[scheduled-recovery] " +
        JSON.stringify({
          outcome: "transport_failed",
          checked: recovery.checked,
          transportFailed: recovery.transportFailed,
        }),
    );
    // Do not emit an alert transition that this execution cannot retain as its
    // result code. The next successful monitor run will evaluate and persist it.
    return NextResponse.json(
      {
        ok: false,
        step: "operations.health-alerts",
        outcome: "recovery_dispatch_unavailable",
        checkedAt: report.checkedAt,
        overall: report.overall,
        alertCount: adverseComponents.length,
        alertsOpen: adverseComponents.length > 0,
        scheduledRecovery: recovery,
      },
      { status: 503 },
    );
  }
  if (transition.emission === "open" || transition.emission === "reminder") {
    console.error(
      "[health-alert] " +
        JSON.stringify({
          transition: transition.emission,
          overall: report.overall,
          adverseComponents,
          statusPageDecision: decision,
        }),
    );
  } else if (transition.emission === "recovered") {
    console.info(
      "[health-alert] " +
        JSON.stringify({ transition: "recovered", overall: report.overall }),
    );
  }
  return NextResponse.json({
    ok: true,
    step: "operations.health-alerts",
    outcome: transition.resultCode,
    checkedAt: report.checkedAt,
    overall: report.overall,
    alertCount: adverseComponents.length,
    alertsOpen: adverseComponents.length > 0,
    alertTransition: transition.state,
    statusPageDecision: decision,
    scheduledRecovery: recovery,
  });
}

const cronHandler = withCronJob("operations.health-alerts", handler);

export { cronHandler as GET, cronHandler as POST };
