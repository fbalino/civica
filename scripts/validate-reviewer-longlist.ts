import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REVIEWER_LONGLIST,
  reviewerLonglistErrors,
} from "../src/lib/research/reviewer-longlist";
import {
  buildReviewerLonglistArtifact,
  renderReviewerLonglistReport,
} from "./generate-reviewer-longlist";

const checked = JSON.parse(readFileSync("data/research/reviewer-longlist-v1.json", "utf8"));
assert.deepEqual(reviewerLonglistErrors(), []);
assert.deepEqual(checked, buildReviewerLonglistArtifact());
assert.equal(
  readFileSync("plan/research/reviewer-longlist-v1.md", "utf8"),
  renderReviewerLonglistReport(checked),
);
assert.equal(checked.candidates.length, 24);
assert.equal(checked.candidates.every((candidate: { contacted: boolean }) => !candidate.contacted), true);
assert.equal(/mailto:|@[a-z0-9.-]+\.[a-z]{2,}|\+\d{7,}/i.test(JSON.stringify(checked)), false);

for (const lane of [
  "governance_measurement",
  "political_event_data",
  "research_data_curation",
]) {
  const candidates = REVIEWER_LONGLIST.candidates.filter((candidate) => candidate.lane === lane);
  assert.equal(candidates.length, 8);
  assert.ok(candidates.some(({ geographicGroup }) => geographicGroup === "outside_us_eu_uk"));
}

console.log(
  `PASS — ${checked.schemaVersion}: 8 governance-measurement + 8 event-data + 8 data-curation candidates, public professional channels only, no contact.`,
);
