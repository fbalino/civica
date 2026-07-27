import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atlasReviewPacketErrors } from "../src/lib/research/atlas-review-packet";
import { buildAtlasReviewPacket, renderAtlasQuestions, renderAtlasReadme } from "./generate-atlas-review-packet";

const checked = JSON.parse(readFileSync("data/releases/civica-atlas-review-packet-2026-07-v2/manifest.v1.json", "utf8"));
assert.deepEqual(atlasReviewPacketErrors(), []);
assert.deepEqual(checked, buildAtlasReviewPacket());
assert.equal(readFileSync("data/releases/civica-atlas-review-packet-2026-07-v2/review-questionnaire.md", "utf8"), renderAtlasQuestions(checked));
assert.equal(readFileSync("data/releases/civica-atlas-review-packet-2026-07-v2/README.md", "utf8"), renderAtlasReadme(checked));
console.log("PASS — Atlas review packet paths, hashes, required artifact classes, questionnaire, and no-endorsement posture close.");
