import { existsSync } from "node:fs";

export interface Qa011OperatorJourney {
  id: string;
  outcome: string;
  tests: readonly string[];
}

export const QA_011_OPERATOR_JOURNEYS: readonly Qa011OperatorJourney[] = [
  {
    id: "admin-session-and-safe-mutation",
    outcome:
      "owner login/session, same-origin mutation protection, audit recording, revocation, and safe failure responses",
    tests: [
      "src/lib/admin/password.test.ts",
      "src/lib/admin/session.test.ts",
      "src/lib/admin/login-rate-limit.test.ts",
      "src/lib/admin/session-revocation-store.test.ts",
      "src/lib/admin/mutation.test.ts",
      "src/lib/admin/mutation-error-profile.test.ts",
      "src/lib/admin/logout.test.ts",
      "src/lib/admin/safe-redirect.test.ts",
      "src/lib/api/admin-feed-shapes.test.ts",
      "src/lib/api/admin-mutation-request-guard.test.ts",
      "src/lib/api/__tests__/route-authorization.test.ts",
    ],
  },
  {
    id: "blinded-coding-and-adjudication",
    outcome:
      "coder session, independent queue, lock, comparison, adjudication, export, and audit boundaries",
    tests: [
      "src/lib/pulse/v2/coder-protocol.test.ts",
      "src/lib/pulse/v2/coding-workspace.test.ts",
      "src/lib/pulse/v2/coding-session.test.ts",
      "src/lib/pulse/v2/coding-export.test.ts",
    ],
  },
  {
    id: "disputes-and-corrections",
    outcome:
      "dispute decisions, stale-resolution recovery, severity, and versioned correction outcomes",
    tests: [
      "src/lib/factbook/reconcile/__tests__/auto-resolve-disputes.test.ts",
      "src/lib/factbook/reconcile/__tests__/dispute-resolution.test.ts",
      "src/lib/factbook/reconcile/__tests__/dispute-severity.test.ts",
      "src/lib/policy/__tests__/correction-simulator.test.ts",
    ],
  },
  {
    id: "scheduled-data-delivery-and-recovery",
    outcome:
      "cron authentication, idempotency, durable lease/fence, retries, route delivery, pipeline outcomes, and failure recovery",
    tests: [
      "src/lib/api/cron-input.test.ts",
      "src/lib/api/cron-output.test.ts",
      "src/lib/api/cron-effective-inputs.test.ts",
      "src/lib/api/cron-job.test.ts",
      "src/lib/api/cron-execution-postgres.test.ts",
      "src/lib/api/cron-routes-integration.test.ts",
      "src/lib/api/cron-schedule.test.ts",
      "src/lib/factbook/cron-outcomes.test.ts",
      "src/lib/pulse/v2/cron-dry-run-contract.test.ts",
      "src/lib/pulse/v2/cron-outcomes.test.ts",
      "src/lib/pulse/v2/ingest-cron-retry.test.ts",
      "src/lib/pulse/v2/classify-cron-retry.test.ts",
      "src/lib/pulse/v2/cluster-cron-retry.test.ts",
      "src/lib/pulse/v2/score-cron-retry.test.ts",
    ],
  },
  {
    id: "alert-and-incident-recovery",
    outcome:
      "pipeline, error, and health alerts remain bounded and recover only after the declared healthy state",
    tests: [
      "src/lib/platform/pipeline-observability.test.ts",
      "src/lib/platform/error-monitoring.test.ts",
      "src/lib/platform/health-status.test.ts",
    ],
  },
] as const;

export function qa011OperatorJourneyErrors(
  journeys: readonly Qa011OperatorJourney[] = QA_011_OPERATOR_JOURNEYS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const tests = new Set<string>();
  for (const journey of journeys) {
    if (ids.has(journey.id)) errors.push(`duplicate operator journey: ${journey.id}`);
    ids.add(journey.id);
    if (!journey.outcome.trim()) errors.push(`${journey.id}: missing outcome`);
    if (!journey.tests.length) errors.push(`${journey.id}: no isolated fixture tests`);
    for (const test of journey.tests) {
      if (!test.endsWith(".test.ts")) errors.push(`${journey.id}: not a test file: ${test}`);
      if (!existsSync(test)) errors.push(`${journey.id}: missing test file: ${test}`);
      if (tests.has(test)) errors.push(`${journey.id}: duplicate test file: ${test}`);
      tests.add(test);
    }
  }
  for (const required of [
    "admin-session-and-safe-mutation",
    "blinded-coding-and-adjudication",
    "disputes-and-corrections",
    "scheduled-data-delivery-and-recovery",
    "alert-and-incident-recovery",
  ]) {
    if (!ids.has(required)) errors.push(`missing required operator journey: ${required}`);
  }
  return errors;
}
