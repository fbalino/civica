import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  allocatePrimaryStrata,
  inflateSampleSize,
  pulseEvaluationFramePopulationErrors,
  pulseEvaluationPopulationSemanticSha256,
  pulseEvaluationSamplingErrors,
  simpleRandomProportionSampleSize,
  stableSample,
  type PulseEvaluationFramePopulation,
} from "./evaluation-sampling";

const population = JSON.parse(
  readFileSync(
    "data/research/pulse-evaluation-frame-population-v1.json",
    "utf8",
  ),
) as PulseEvaluationFramePopulation;

function reseal(
  value: PulseEvaluationFramePopulation,
): PulseEvaluationFramePopulation {
  const body: Partial<PulseEvaluationFramePopulation> = { ...value };
  delete body.semanticSha256;
  return {
    ...value,
    semanticSha256: pulseEvaluationPopulationSemanticSha256(body),
  };
}

test("power rationale closes at five percentage points before design inflation", () => {
  const simple = simpleRandomProportionSampleSize({
    z: 1.96,
    proportion: 0.5,
    halfWidth: 0.05,
  });
  assert.equal(simple, 385);
  assert.deepEqual(
    inflateSampleSize({
      simpleRandom: simple,
      designEffect: 1.25,
      unusableFraction: 0.1,
    }),
    { validRequired: 482, initialDraw: 536 },
  );
});

test("bounded allocation honors rare-stratum minima and the exact target", () => {
  const allocation = allocatePrimaryStrata(
    { common: 1000, rare: 8, medium: 100 },
    100,
    10,
  );
  assert.equal(allocation.rare, 8);
  assert.ok(allocation.medium >= 10);
  assert.equal(
    Object.values(allocation).reduce((sum, value) => sum + value, 0),
    100,
  );
});

test("stable sampling is order invariant and quota exact", () => {
  const rows = [
    { id: "a", stratum: "x" },
    { id: "b", stratum: "x" },
    { id: "c", stratum: "y" },
    { id: "d", stratum: "y" },
  ];
  const first = stableSample({
    rows,
    quotas: { x: 1, y: 1 },
    seed: "seed",
    frameId: "frame",
  });
  const second = stableSample({
    rows: [...rows].reverse(),
    quotas: { y: 1, x: 1 },
    seed: "seed",
    frameId: "frame",
  });
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
});

test("the frozen protocol is complete and blind to labels", () => {
  assert.deepEqual(pulseEvaluationSamplingErrors(), []);
});

test("the checked population is internally valid and bound to PUL-042 inputs", () => {
  assert.deepEqual(pulseEvaluationFramePopulationErrors(population), []);

  const frozenInputs = JSON.parse(
    readFileSync(
      "data/research/pulse-evaluation-packet-frozen-inputs-v1.json",
      "utf8",
    ),
  ) as {
    populationArtifactSha256: string;
    acceptedEventIdentityHash: string;
    systemNegativeIdentityHash: string;
  };
  assert.equal(
    frozenInputs.populationArtifactSha256,
    population.semanticSha256,
  );
  assert.equal(
    frozenInputs.acceptedEventIdentityHash,
    population.identityHashes.acceptedEvents,
  );
  assert.equal(
    frozenInputs.systemNegativeIdentityHash,
    population.identityHashes.systemNegatives,
  );
});

test("population validation rejects a stale semantic hash", () => {
  const seeded = structuredClone(population);
  seeded.counts.unresolvedRawCandidates += 1;
  assert.ok(
    pulseEvaluationFramePopulationErrors(seeded).some((error) =>
      error.includes("semantic hash"),
    ),
  );
});

test("population validation rejects resealed protocol, freeze, and count drift", () => {
  const protocol = structuredClone(population);
  protocol.protocolVersion = "drifted" as typeof protocol.protocolVersion;
  assert.ok(
    pulseEvaluationFramePopulationErrors(reseal(protocol)).some((error) =>
      error.includes("protocol version"),
    ),
  );

  const freeze = structuredClone(population);
  freeze.populationFreezeAt = "2026-07-12T00:00:00.000Z";
  assert.ok(
    pulseEvaluationFramePopulationErrors(reseal(freeze)).some((error) =>
      error.includes("freeze timestamp"),
    ),
  );

  const counts = structuredClone(population);
  counts.counts.retainedEventCandidateCensus -= 1;
  assert.ok(
    pulseEvaluationFramePopulationErrors(reseal(counts)).some((error) =>
      error.includes("event-candidate census"),
    ),
  );
});

test("population validation rejects resealed identity and balance drift", () => {
  const identity = structuredClone(population);
  identity.identityHashes.systemNegatives = "not-a-hash";
  assert.ok(
    pulseEvaluationFramePopulationErrors(reseal(identity)).some((error) =>
      error.includes("systemNegatives"),
    ),
  );

  const environments = structuredClone(population);
  environments.balanceCoverage.mediaEvidenceEnvironments.no_retained_documents -= 1;
  assert.ok(
    pulseEvaluationFramePopulationErrors(reseal(environments)).some((error) =>
      error.includes("do not sum"),
    ),
  );
});
