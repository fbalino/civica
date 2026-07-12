import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REVIEWER_LANE_IDS,
  REVIEWER_SELECTION_CONTRACT,
  reviewerSelectionErrors,
} from "../src/lib/research/reviewer-selection";
import { buildReviewerSelectionArtifact } from "./generate-reviewer-selection-criteria";

const artifact = JSON.parse(
  readFileSync("data/research/reviewer-selection-criteria-v1.json", "utf8"),
);
const policy = readFileSync("plan/research/reviewer-selection-criteria-v1.md", "utf8");

assert.deepEqual(reviewerSelectionErrors(), []);
assert.deepEqual(artifact, buildReviewerSelectionArtifact());
assert.ok(policy.includes(REVIEWER_SELECTION_CONTRACT.schemaVersion));
for (const lane of REVIEWER_LANE_IDS) assert.ok(policy.includes(`\`${lane}\``));
assert.ok(policy.includes("No one has been contacted"));
assert.ok(policy.includes("GOV-016"));
assert.equal(/mailto:|@[a-z0-9.-]+\.[a-z]{2,}|\+\d{7,}/i.test(policy), false);

console.log(
  `PASS — ${artifact.schemaVersion}: five documented lanes, three core scholarly lanes, no named people or private contact data, and contact blocked before GOV-016.`,
);
