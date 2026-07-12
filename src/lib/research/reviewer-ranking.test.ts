import assert from "node:assert/strict";
import test from "node:test";
import { buildReviewerRanking, reviewerRankingErrors } from "./reviewer-ranking";

test("ranking preserves three alternates and never guesses availability", () => {
  const ranking = buildReviewerRanking();
  assert.deepEqual(reviewerRankingErrors(ranking), []);
  for (const lane of ranking.lanes) {
    assert.equal(lane.ranked.filter((row) => row.disposition === "proposed_primary").length, 3);
    assert.equal(lane.ranked.filter((row) => row.disposition === "alternate").length, 3);
    assert.ok(lane.ranked.every((row) => row.scores.availabilitySignal === 0));
  }
});
