import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  REVIEWER_SELECTION_CONTRACT,
  reviewerSelectionErrors,
  reviewerSelectionHash,
} from "../src/lib/research/reviewer-selection";

const OUTPUT = resolve("data/research/reviewer-selection-criteria-v1.json");
const WRITE = process.argv.includes("--write");

export function buildReviewerSelectionArtifact() {
  const body = { ...REVIEWER_SELECTION_CONTRACT };
  return { ...body, semanticSha256: reviewerSelectionHash(body) };
}

function main() {
  assert.deepEqual(reviewerSelectionErrors(), []);
  const artifact = buildReviewerSelectionArtifact();
  if (WRITE) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`);
  } else {
    assert.ok(existsSync(OUTPUT), "checked reviewer-selection artifact is missing");
    assert.deepEqual(JSON.parse(readFileSync(OUTPUT, "utf8")), artifact);
  }
  console.log(
    `PASS — ${artifact.lanes.length} reviewer lanes; names=0; contact=blocked; ${artifact.semanticSha256}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
