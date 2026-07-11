import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndexSourceDependenceResult } from "./generate-index-source-dependence";

const stored = JSON.parse(readFileSync("data/releases/index-source-dependence-v1/result.v1.json", "utf8"));
const rebuilt = buildIndexSourceDependenceResult();
assert.deepEqual(rebuilt, stored);
assert.equal(stored.publisherLayer.nominalPublisherCount, 4);
assert.equal(stored.publisherLayer.civicaObservedInputCount, 0);
assert.equal(stored.publisherLayer.leaveOnePublisherOut.length, 4);
assert.equal(stored.upstreamLayer.leaveOneFamilyOut, "not_identifiable_from_published_aggregates");
assert.equal(stored.similarityDecomposition.deterministicInputShare, 1);
assert.equal(stored.similarityDecomposition.civicaObservationShare, 0);
assert.equal(stored.claimRules.independentCorroborationAllowed, false);
console.log(`PASS — source dependence ${stored.resultSha256} maps publisher and upstream overlap without manufacturing independence.`);
