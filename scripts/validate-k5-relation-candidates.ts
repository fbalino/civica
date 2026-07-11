import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { K5_RELATION_CONTRACT, k5RelationErrors } from "../src/lib/ci/tournament-candidate-k5";
import { buildK5RelationCandidates } from "./generate-k5-relation-candidates";

async function main() { const stored = JSON.parse(readFileSync("data/releases/k5-institutional-relation-candidates-v1/manifest.v1.json", "utf8")); const { outputs, manifest } = await buildK5RelationCandidates(); assert.deepEqual(manifest, stored); assert.equal(k5RelationErrors(outputs).length, 0); assert.equal(manifest.graphEdgesPublished, 0); assert.equal(manifest.heldoutLabelsInspected, false); assert.equal(manifest.bySplit.reduce((sum, row) => sum + row.candidates, 0), manifest.candidateRows); assert.equal(K5_RELATION_CONTRACT.validation.krippendorffAlpha, 0.8); console.log(`PASS — K5 reproduces ${manifest.candidateRows} private relation candidates at ${manifest.outputSha256}; zero graph edges are asserted.`); }
main().catch((error) => { console.error(error); process.exit(1); });
