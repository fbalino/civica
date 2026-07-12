import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewerRankingErrors } from "../src/lib/research/reviewer-ranking";
import {
  buildReviewerRankingArtifact,
  renderReviewerRanking,
} from "./generate-reviewer-ranking";

const checked = JSON.parse(readFileSync("data/research/reviewer-ranking-v1.json", "utf8"));
assert.deepEqual(checked, buildReviewerRankingArtifact());
assert.deepEqual(reviewerRankingErrors(checked), []);
assert.equal(readFileSync("plan/research/reviewer-ranking-v1.md", "utf8"), renderReviewerRanking(checked));
assert.equal(checked.lanes.flatMap((lane: { ranked: unknown[] }) => lane.ranked).length, 24);
console.log("PASS — reviewer ranking is complete, reproducible, unknown-safe, alternate-preserving, owner-gated, and contact-free.");
