import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPulseEvaluationPacketManifest,
  pulseEvaluationPacketManifestErrors,
  type PulseEvaluationPacketInput,
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

test("evaluation manifests freeze the census and deterministic negative draw without labels", () => {
  const events = Array.from({ length: 384 }, (_, index) =>
    packet(`event-${String(index).padStart(3, "0")}`),
  );
  const negatives = Array.from({ length: 978 }, (_, index) =>
    packet(`negative-${String(index).padStart(3, "0")}`),
  );
  const manifest = buildPulseEvaluationPacketManifest({
    populationArtifactSha256: hash("population"),
    acceptedEventIdentityHash: hash(events.map(({ unitRef }) => unitRef)),
    systemNegativeIdentityHash: hash(
      negatives.map(({ unitRef }) => `raw:${unitRef}`),
    ),
    eventCandidates: events,
    systemNegativePopulation: negatives,
  });
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
