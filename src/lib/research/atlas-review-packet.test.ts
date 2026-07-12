import assert from "node:assert/strict";
import test from "node:test";
import { ATLAS_REVIEW_ARTIFACTS, ATLAS_REVIEW_QUESTIONS, atlasReviewPacketErrors } from "./atlas-review-packet";

test("Atlas review packet closes all required curation evidence classes", () => {
  assert.deepEqual(atlasReviewPacketErrors(), []);
  assert.equal(ATLAS_REVIEW_ARTIFACTS.length, 15);
  assert.equal(ATLAS_REVIEW_QUESTIONS.length, 10);
});
