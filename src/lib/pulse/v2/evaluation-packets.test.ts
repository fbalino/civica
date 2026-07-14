import assert from "node:assert/strict";
import test from "node:test";
import {
  auditPulseEvaluationPacketLiveDifferences,
  buildPulseEvaluationPacketFrozenInputs,
  buildPulseEvaluationPacketManifest,
  pulseEvaluationPacketFrozenInputErrors,
  pulseEvaluationPacketManifestErrors,
  pulseEvaluationPacketReleaseErrors,
  type PulseEvaluationPacketInput,
  type PulseEvaluationPacketPopulationReference,
} from "./evaluation-packets";
import { createHash } from "node:crypto";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function packet(unitRef: string): PulseEvaluationPacketInput {
  return {
    unitRef,
    referenceDate: "2026-06-15",
    primaryStratum: "pending",
    evidence: [
      {
        evidenceIdentityKey: `pulse-evidence/sha256:${hash(unitRef)}`,
        evidenceContentHash: hash({ unitRef }),
        sourceFamilyId: "fixture",
        sourceType: "news",
        language: "en",
        reportedDate: "2026-06-15",
        retrievedAt: "2026-06-15T12:00:00.000Z",
      },
    ],
  };
}

function fixtureRelease() {
  const events = Array.from({ length: 384 }, (_, index) =>
    packet(`event-${String(index).padStart(3, "0")}`),
  );
  const negatives = Array.from({ length: 978 }, (_, index) =>
    packet(`negative-${String(index).padStart(3, "0")}`),
  );
  const populationArtifactSha256 = hash("population");
  const acceptedEventIdentityHash = hash(events.map(({ unitRef }) => unitRef));
  const systemNegativeIdentityHash = hash(
    negatives.map(({ unitRef }) => `raw:${unitRef}`),
  );
  const manifest = buildPulseEvaluationPacketManifest({
    populationArtifactSha256,
    acceptedEventIdentityHash,
    systemNegativeIdentityHash,
    eventCandidates: events,
    systemNegativePopulation: negatives,
  });
  const frozenInputs = buildPulseEvaluationPacketFrozenInputs({
    populationArtifactSha256,
    acceptedEventIdentityHash,
    systemNegativeIdentityHash,
    packetManifestSemanticSha256: manifest.semanticSha256,
    retainedInputSnapshotAt: "2026-07-12T08:53:48.502Z",
    eventCandidates: events,
    systemNegativePopulation: negatives,
  });
  const population: PulseEvaluationPacketPopulationReference = {
    protocolVersion: "pulse-evaluation-sampling-frame/v1",
    populationFreezeAt: "2026-07-11T16:45:00.899Z",
    semanticSha256: populationArtifactSha256,
    counts: {
      retainedEventCandidateCensus: events.length,
      systemNegativePopulation: negatives.length,
    },
    identityHashes: {
      acceptedEvents: acceptedEventIdentityHash,
      systemNegatives: systemNegativeIdentityHash,
    },
  };
  return { events, negatives, manifest, frozenInputs, population };
}

test("evaluation manifests freeze the census and deterministic negative draw without labels", () => {
  const { manifest } = fixtureRelease();
  assert.deepEqual(manifest.counts, {
    eventCensus: 384,
    systemNegativeInitialDraw: 536,
    systemNegativeAnalysisTarget: 482,
    systemNegativeReserve: 54,
    totalPackets: 920,
  });
  assert.deepEqual(pulseEvaluationPacketManifestErrors(manifest), []);
  assert.equal(JSON.stringify(manifest).includes("productionLabel"), false);
  assert.equal(JSON.stringify(manifest).includes("headline"), false);
});

test("retained inputs validate the release without consulting mutable live rows", () => {
  const { events, negatives, manifest, frozenInputs, population } = fixtureRelease();
  const frozenBytes = JSON.stringify(frozenInputs);
  assert.deepEqual(
    pulseEvaluationPacketReleaseErrors({ frozenInputs, manifest, population }),
    [],
  );

  const lateLiveEvent = packet("event-late-after-freeze");
  const changedLiveNegatives = negatives.map((row, index) =>
    index === 0 ? { ...row, primaryStratum: "non_governance" } : row,
  );
  const audit = auditPulseEvaluationPacketLiveDifferences({
    frozenInputs,
    checkedManifest: manifest,
    liveEventCandidates: [...events, lateLiveEvent],
    liveSystemNegativePopulation: changedLiveNegatives,
  });

  assert.equal(audit.liveManifestStatus, "cannot_rebuild");
  assert.deepEqual(audit.eventCandidates.addedUnitRefs, [lateLiveEvent.unitRef]);
  assert.deepEqual(audit.systemNegativePopulation.frozenPrimaryStratumCounts, {
    pending: 978,
  });
  assert.deepEqual(audit.systemNegativePopulation.livePrimaryStratumCounts, {
    non_governance: 1,
    pending: 977,
  });
  assert.deepEqual(audit.systemNegativePopulation.primaryStratumTransitions, {
    "pending->non_governance": 1,
  });
  assert.equal(JSON.stringify(frozenInputs), frozenBytes);
  assert.deepEqual(
    pulseEvaluationPacketReleaseErrors({ frozenInputs, manifest, population }),
    [],
    "post-freeze live changes must not alter the DB-free release validator",
  );
});

test("frozen-input and checked-manifest tampering fail closed", () => {
  const { manifest, frozenInputs, population } = fixtureRelease();
  const tamperedInputs = structuredClone(frozenInputs);
  tamperedInputs.systemNegativePopulation[0].unitRef = "negative-seeded-tamper";
  const inputErrors = pulseEvaluationPacketFrozenInputErrors(tamperedInputs, population);
  assert.ok(inputErrors.some((error) => error.includes("identity hash drifted")));
  assert.ok(inputErrors.includes("frozen-input hash drifted"));

  const payloadLeak = structuredClone(frozenInputs) as typeof frozenInputs & {
    title?: string;
  };
  payloadLeak.title = "publisher payload must remain private";
  assert.ok(
    pulseEvaluationPacketFrozenInputErrors(payloadLeak, population).includes(
      "publisher payload leaked into frozen inputs",
    ),
  );

  const tamperedManifest = structuredClone(manifest);
  tamperedManifest.packets[0].primaryStratum = "seeded-tamper";
  const manifestErrors = pulseEvaluationPacketReleaseErrors({
    frozenInputs,
    manifest: tamperedManifest,
    population,
  });
  assert.ok(manifestErrors.some((error) => error.includes("packet material hash drifted")));
  assert.ok(manifestErrors.includes("manifest hash drifted"));
});

test("evaluation manifest rejects production outputs and answer fields", () => {
  const fake = {
    schemaVersion: "pulse-evaluation-packet-manifest/v1",
    protocolVersion: "pulse-evaluation-sampling-frame/v1",
    populationFreezeAt: "2026-07-11T16:45:00.899Z",
    populationArtifactSha256: hash("population"),
    labelStatus: "unlabeled",
    rightsPosture: "private_rehydration_only_no_publisher_payload",
    counts: {
      eventCensus: 384,
      systemNegativeInitialDraw: 536,
      systemNegativeAnalysisTarget: 482,
      systemNegativeReserve: 54,
      totalPackets: 920,
    },
    packets: [],
    productionLabel: "leak",
    semanticSha256: "bad",
  } as never;
  assert.ok(
    pulseEvaluationPacketManifestErrors(fake).some((error) =>
      error.includes("leaked"),
    ),
  );
});
