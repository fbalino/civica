import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  INDEX_RESEARCH_ARCHIVE,
  indexResearchArchiveErrors,
  type IndexResearchArchiveManifest,
} from "./index-research-archive";

const manifest = JSON.parse(
  readFileSync(`data/releases/${INDEX_RESEARCH_ARCHIVE.releaseId}/manifest.v1.json`, "utf8"),
) as IndexResearchArchiveManifest;

test("research archive preserves all failed and null candidates without recommendation", () => {
  assert.deepEqual(indexResearchArchiveErrors(manifest), []);
  assert.deepEqual(manifest.candidates.map((row) => row.id), ["K1", "K2", "K3", "K4", "K5"]);
  assert.deepEqual(manifest.failedThresholds.map((row) => row.id), ["K1-originality", "K2-drop-one"]);
  assert.equal(manifest.publicStanding.recommendedCandidateIds.length, 0);
});

test("archive rejects silent revival and missing adverse evidence", () => {
  const revived = structuredClone(manifest);
  revived.publicStanding.recommendedCandidateIds = ["K1"];
  assert.ok(indexResearchArchiveErrors(revived).includes("an archived candidate became recommended"));

  const softened = structuredClone(manifest);
  softened.failedThresholds = softened.failedThresholds.slice(0, 1);
  assert.ok(indexResearchArchiveErrors(softened).includes("failed threshold inventory is incomplete"));

  const unlabelled = structuredClone(manifest);
  unlabelled.candidates[0].standing = "research";
  assert.ok(indexResearchArchiveErrors(unlabelled).includes("K1 lacks non-recommendation standing"));
});
