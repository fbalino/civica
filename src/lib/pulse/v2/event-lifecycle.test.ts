import assert from "node:assert/strict";
import test from "node:test";

import {
  PULSE_EVENT_LIFECYCLE_VERSION,
  PULSE_SCORE_EVENT_LIFECYCLE_POLICY,
  PULSE_SCORE_WINDOW_BOUNDARY,
  isScoreableEventLifecycle,
} from "./event-lifecycle";

const eligible = {
  projectionStatus: "current" as const,
  published: true,
  reviewStatus: "approved" as const,
  category: "foreign_occupation",
};

test("score lifecycle permits only a current, published, reviewed event projection", () => {
  assert.equal(isScoreableEventLifecycle(eligible), true);
  assert.equal(
    isScoreableEventLifecycle({
      ...eligible,
      projectionStatus: "superseded_duplicate",
    }),
    false,
  );
  assert.equal(isScoreableEventLifecycle({ ...eligible, published: false }), false);
  assert.equal(
    isScoreableEventLifecycle({ ...eligible, reviewStatus: "pending" }),
    false,
  );
  assert.equal(isScoreableEventLifecycle({ ...eligible, category: "none" }), false);
});

test("score lifecycle makes supersession, persistence, and recurrence explicit", () => {
  assert.equal(
    PULSE_SCORE_EVENT_LIFECYCLE_POLICY.version,
    PULSE_EVENT_LIFECYCLE_VERSION,
  );
  assert.equal(
    PULSE_SCORE_EVENT_LIFECYCLE_POLICY.supersession,
    "current_projection_only_with_retained_superseded_history",
  );
  assert.equal(
    PULSE_SCORE_EVENT_LIFECYCLE_POLICY.persistence,
    "never_inferred_from_an_earlier_event_or_extended_without_new_evidence",
  );
  assert.equal(
    PULSE_SCORE_EVENT_LIFECYCLE_POLICY.recurrence,
    "separately_accepted_later_event_with_its_own_date_and_incident",
  );
  assert.equal(
    PULSE_SCORE_WINDOW_BOUNDARY,
    "inclusive_maximum_configured_half_life_days_future_excluded",
  );
});
