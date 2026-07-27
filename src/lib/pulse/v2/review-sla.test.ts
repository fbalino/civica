import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_REVIEW_PRIORITY_BY_SEVERITY,
  PULSE_REVIEW_SLA_VERSION,
  aggregatePulseReviewHealth,
  derivePulseReviewCompliance,
  pulseReviewDeadlines,
  reviewPriorityForQueueItem,
  type PulseReviewObligation,
} from "./review-sla";
import type { SeverityTier } from "./types";

const queuedAt = "2026-07-12T10:00:00.000Z";

function obligation(
  overrides: Partial<PulseReviewObligation> = {},
): PulseReviewObligation {
  return {
    state: "open",
    priority: "standard",
    queuedAt,
    ...overrides,
  };
}

test("the v1 contract maps every severity tier to a closed priority", () => {
  assert.equal(PULSE_REVIEW_SLA_VERSION, "pulse-review-sla/v1");
  const tiers: SeverityTier[] = [
    "low_pos",
    "moderate_pos",
    "high_pos",
    "low_neg",
    "moderate_neg",
    "severe_neg",
    "catastrophic_neg",
  ];
  assert.deepEqual(
    tiers.map((tier) => PULSE_REVIEW_PRIORITY_BY_SEVERITY[tier]),
    [
      "standard",
      "standard",
      "urgent",
      "standard",
      "standard",
      "urgent",
      "critical",
    ],
  );
  assert.equal(
    reviewPriorityForQueueItem({ reason: "missing_attribution" }),
    "standard",
  );
});

test("deadlines use deterministic UTC arithmetic for each priority", () => {
  assert.deepEqual(pulseReviewDeadlines({ priority: "critical", queuedAt }), {
    priority: "critical",
    queuedAt,
    escalationAt: queuedAt,
    dueAt: "2026-07-13T10:00:00.000Z",
  });
  assert.deepEqual(pulseReviewDeadlines({ priority: "urgent", queuedAt }), {
    priority: "urgent",
    queuedAt,
    escalationAt: "2026-07-13T10:00:00.000Z",
    dueAt: "2026-07-15T10:00:00.000Z",
  });
  assert.deepEqual(pulseReviewDeadlines({ priority: "standard", queuedAt }), {
    priority: "standard",
    queuedAt,
    escalationAt: "2026-07-17T10:00:00.000Z",
    dueAt: "2026-07-19T10:00:00.000Z",
  });
});

test("boundary instants escalate inclusively and breach at the due instant", () => {
  assert.equal(
    derivePulseReviewCompliance({
      obligation: obligation({ priority: "urgent" }),
      now: "2026-07-13T10:00:00.000Z",
    }).state,
    "escalation_due",
  );
  assert.equal(
    derivePulseReviewCompliance({
      obligation: obligation({ priority: "urgent" }),
      now: "2026-07-15T10:00:00.000Z",
    }).state,
    "breached_unexcepted",
  );
  assert.equal(
    derivePulseReviewCompliance({
      obligation: obligation({ priority: "critical" }),
      now: queuedAt,
    }).state,
    "escalation_due",
  );
});

test("an exception records an explained breach without restoring completeness", () => {
  const compliance = derivePulseReviewCompliance({
    obligation: obligation({ exceptionRecorded: true }),
    now: "2026-07-19T10:00:00.000Z",
  });
  assert.equal(compliance.state, "breached_excepted");
  assert.equal(compliance.dailyCompletenessEligible, false);
});

test("dispositions are on time only before the due instant", () => {
  assert.equal(
    derivePulseReviewCompliance({
      obligation: obligation({
        state: "dispositioned",
        dispositionedAt: "2026-07-19T09:59:59.999Z",
      }),
      now: "2026-07-20T10:00:00.000Z",
    }).state,
    "dispositioned_on_time",
  );
  assert.equal(
    derivePulseReviewCompliance({
      obligation: obligation({
        state: "dispositioned",
        dispositionedAt: "2026-07-19T10:00:00.000Z",
      }),
      now: "2026-07-20T10:00:00.000Z",
    }).state,
    "dispositioned_late",
  );
});

test("legacy obligations remain quarantined and not completeness eligible", () => {
  assert.deepEqual(
    derivePulseReviewCompliance({
      obligation: obligation({ state: "legacy_quarantined" }),
      now: "2026-07-20T10:00:00.000Z",
    }),
    {
      state: "legacy_quarantined",
      escalationAt: null,
      dueAt: null,
      exceptionRecorded: false,
      dailyCompletenessEligible: false,
    },
  );
});

test("daily health distinguishes complete, pending, failed, and unknown review populations", () => {
  assert.deepEqual(
    aggregatePulseReviewHealth({
      complianceStates: ["dispositioned_on_time"],
      populationKnown: true,
    }),
    { state: "complete", dailyCompletenessEligible: true },
  );
  assert.deepEqual(
    aggregatePulseReviewHealth({
      complianceStates: ["within_sla", "escalation_due"],
      populationKnown: true,
    }),
    { state: "current_reviews_pending", dailyCompletenessEligible: true },
  );
  assert.deepEqual(
    aggregatePulseReviewHealth({
      complianceStates: ["breached_excepted"],
      populationKnown: true,
    }),
    { state: "incomplete_review_sla", dailyCompletenessEligible: false },
  );
  assert.deepEqual(
    aggregatePulseReviewHealth({
      complianceStates: [],
      populationKnown: false,
    }),
    { state: "not_assessable", dailyCompletenessEligible: false },
  );
});

test("date inputs without an explicit UTC offset fail closed", () => {
  assert.throws(
    () =>
      pulseReviewDeadlines({ priority: "standard", queuedAt: "2026-07-12" }),
    /UTC offset/,
  );
});
