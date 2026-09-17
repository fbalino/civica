import assert from "node:assert/strict";
import test from "node:test";

import { cronAlertTransition } from "./cron-alert-transition";

const NOW = new Date("2026-09-17T12:00:00.000Z");
const SIGNATURE = "0123456789abcdef";

test("an adverse non-core health state opens after two consecutive observations", () => {
  const first = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [],
  });
  assert.equal(first.state, "observed");
  assert.equal(first.emission, "none");

  const second = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      {
        resultCode: first.resultCode,
        completedAt: new Date("2026-09-17T11:45:00.000Z"),
      },
    ],
  });
  assert.equal(second.state, "open");
  assert.equal(second.emission, "open");
  assert.equal(second.consecutiveAdverseObservations, 2);
});

test("unchanged incidents are suppressed until cooldown and then reminded", () => {
  const opened = {
    resultCode: `health_alert_open_${SIGNATURE}`,
    completedAt: new Date("2026-09-17T07:00:01.000Z"),
  };
  const suppressed = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [opened],
  });
  assert.equal(suppressed.state, "suppressed");
  assert.equal(suppressed.emission, "none");

  const reminder = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [{ ...opened, completedAt: new Date("2026-09-17T06:00:00.000Z") }],
  });
  assert.equal(reminder.state, "reminder");
  assert.equal(reminder.emission, "reminder");
});

test("recovery is emitted once and a core outage opens immediately", () => {
  const recovered = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      {
        resultCode: `health_alert_open_${SIGNATURE}`,
        completedAt: new Date("2026-09-17T11:45:00.000Z"),
      },
    ],
  });
  assert.equal(recovered.emission, "recovered");

  const clear = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [{ resultCode: recovered.resultCode, completedAt: NOW }],
  });
  assert.equal(clear.state, "clear");
  assert.equal(clear.emission, "none");

  const immediate = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    immediate: true,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [],
  });
  assert.equal(immediate.emission, "open");
});

test("a single observation that never opened clears without a false recovery", () => {
  const transition = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      {
        resultCode: `health_alert_observed_${SIGNATURE}`,
        completedAt: new Date("2026-09-17T11:45:00.000Z"),
      },
    ],
  });
  assert.equal(transition.state, "clear");
  assert.equal(transition.emission, "none");
});

test("a suppressed incident still emits one recovery after its open state", () => {
  const transition = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      {
        resultCode: `health_alert_suppressed_${SIGNATURE}`,
        completedAt: new Date("2026-09-17T11:45:00.000Z"),
      },
      {
        resultCode: `health_alert_open_${SIGNATURE}`,
        completedAt: new Date("2026-09-17T11:30:00.000Z"),
      },
    ],
  });
  assert.equal(transition.state, "recovered");
  assert.equal(transition.emission, "recovered");
});

test("non-alert control outcomes preserve emitted incidents but break pre-open streaks", () => {
  const controlOutcome = {
    resultCode: "recovery_dispatch_unavailable",
    completedAt: new Date("2026-09-17T11:50:00.000Z"),
  };
  const opened = {
    resultCode: `health_alert_open_${SIGNATURE}`,
    completedAt: new Date("2026-09-17T11:45:00.000Z"),
  };
  const stillOpen = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [controlOutcome, opened],
  });
  assert.equal(stillOpen.state, "suppressed");
  assert.equal(stillOpen.emission, "none");
  assert.equal(stillOpen.consecutiveAdverseObservations, 1);

  const recovered = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [controlOutcome, opened],
  });
  assert.equal(recovered.emission, "recovered");

  const observedOnly = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: SIGNATURE,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      controlOutcome,
      {
        resultCode: `health_alert_observed_${SIGNATURE}`,
        completedAt: new Date("2026-09-17T11:45:00.000Z"),
      },
    ],
  });
  assert.equal(observedOnly.state, "observed");
  assert.equal(observedOnly.consecutiveAdverseObservations, 1);
});

test("a changed adverse state supersedes an open incident and later recovers", () => {
  const nextSignature = "fedcba9876543210";
  const opened = {
    resultCode: `health_alert_open_${SIGNATURE}`,
    completedAt: new Date("2026-09-17T11:30:00.000Z"),
  };
  const changed = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: nextSignature,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [opened],
  });
  assert.equal(changed.state, "open");
  assert.equal(changed.emission, "open");
  assert.equal(changed.resultCode, `health_alert_open_${nextSignature}`);

  const recovered = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [
      { resultCode: changed.resultCode, completedAt: NOW },
      opened,
    ],
  });
  assert.equal(recovered.emission, "recovered");
  assert.equal(
    recovered.resultCode,
    `health_alert_recovered_${nextSignature}`,
  );
});

test("clear closes an older open incident behind a newer observed signature", () => {
  const nextSignature = "fedcba9876543210";
  const history = [
    {
      resultCode: `health_alert_observed_${nextSignature}`,
      completedAt: new Date("2026-09-17T11:45:00.000Z"),
    },
    {
      resultCode: `health_alert_open_${SIGNATURE}`,
      completedAt: new Date("2026-09-17T11:30:00.000Z"),
    },
  ];
  const recovered = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history,
  });
  assert.equal(recovered.emission, "recovered");
  assert.equal(recovered.resultCode, `health_alert_recovered_${SIGNATURE}`);

  const clear = cronAlertTransition({
    namespace: "health",
    now: NOW,
    currentSignature: null,
    reminderCooldownMs: 6 * 60 * 60 * 1_000,
    history: [{ resultCode: recovered.resultCode, completedAt: NOW }, ...history],
  });
  assert.equal(clear.state, "clear");
  assert.equal(clear.emission, "none");
});
