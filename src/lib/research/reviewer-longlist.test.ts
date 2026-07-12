import assert from "node:assert/strict";
import test from "node:test";
import { REVIEWER_LONGLIST, reviewerLonglistErrors } from "./reviewer-longlist";

test("verified reviewer longlist closes all three core lanes without contact data", () => {
  assert.deepEqual(reviewerLonglistErrors(), []);
  assert.equal(REVIEWER_LONGLIST.candidates.length, 24);
  for (const lane of [
    "governance_measurement",
    "political_event_data",
    "research_data_curation",
  ])
    assert.equal(REVIEWER_LONGLIST.candidates.filter((row) => row.lane === lane).length, 8);
});

test("longlist rejects missing geographic coverage and direct contact data", () => {
  const broken = {
    ...REVIEWER_LONGLIST,
    candidates: REVIEWER_LONGLIST.candidates.map((candidate) =>
      candidate.lane === "political_event_data"
        ? { ...candidate, geographicGroup: "us" }
        : candidate,
    ),
    contactPolicy: "Write to reviewer@example.org",
  } as never;
  const errors = reviewerLonglistErrors(broken);
  assert.ok(errors.includes("political_event_data: no qualified outside-US/EU/UK perspective"));
  assert.ok(errors.includes("private or direct contact data entered the longlist"));
});
