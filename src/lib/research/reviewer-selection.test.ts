import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEWER_SELECTION_CONTRACT,
  reviewerSelectionErrors,
} from "./reviewer-selection";

test("reviewer selection closes all five names-free lanes before contact", () => {
  assert.deepEqual(reviewerSelectionErrors(), []);
  assert.deepEqual(
    REVIEWER_SELECTION_CONTRACT.lanes.map(({ id }) => id),
    [
      "governance_measurement",
      "political_event_data",
      "research_data_curation",
      "accessibility",
      "legal_source_rights",
    ],
  );
  assert.equal(JSON.stringify(REVIEWER_SELECTION_CONTRACT).includes("mailto:"), false);
});

test("reviewer selection rejects a missing lane and contact-gate drift", () => {
  const broken = {
    ...REVIEWER_SELECTION_CONTRACT,
    contactGate: "Contact candidates now.",
    lanes: REVIEWER_SELECTION_CONTRACT.lanes.slice(0, 4),
  } as never;
  const errors = reviewerSelectionErrors(broken);
  assert.ok(errors.includes("contact gate is incomplete"));
  assert.ok(errors.includes("five reviewer lanes are required"));
  assert.ok(errors.includes("reviewer lane closure drifted"));
});
