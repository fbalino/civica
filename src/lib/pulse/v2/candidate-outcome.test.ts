import assert from "node:assert/strict";
import test from "node:test";

import { createPulseCandidateOutcome } from "./candidate-outcome";

const base = {
  candidateKind: "raw_item" as const,
  candidateId: "pulse-evidence/sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  outcome: "duplicate" as const,
  reasonCode: "source_url_duplicate",
  reason: "The source URL already resolves to a retained item.",
  actor: { type: "classifier" as const, provider: "civica", model: "ingest-deduplicator", reviewerId: null },
  methodVersion: "pulse-v2.8-beta",
  stageRunId: "11111111-1111-4111-8111-111111111111",
  canonicalCandidateId: "pulse-evidence/sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  evidenceRefs: ["raw-event:fixture", "raw-event:fixture", "source:fixture"],
  metadata: { sourceUrl: "https://example.test/event", sourceId: "fixture" },
  occurredAt: "2026-07-11T22:00:00.000Z",
  nonce: "run:0",
};

test("candidate outcome identity is deterministic and evidence-order invariant", () => {
  const first = createPulseCandidateOutcome(base);
  const second = createPulseCandidateOutcome({ ...base, evidenceRefs: ["source:fixture", "raw-event:fixture"], metadata: { sourceId: "fixture", sourceUrl: "https://example.test/event" } });
  assert.equal(first.outcomeKey, second.outcomeKey);
  assert.match(first.outcomeKey, /^pulse-candidate-outcome\/sha256:[a-f0-9]{64}$/);
  assert.deepEqual(first.evidenceRefs, ["raw-event:fixture", "source:fixture"]);
});

test("distinct duplicate attempts remain distinct evaluation evidence", () => {
  assert.notEqual(createPulseCandidateOutcome(base).outcomeKey, createPulseCandidateOutcome({ ...base, nonce: "run:1" }).outcomeKey);
});

test("outcomes fail closed without reason, version, run, time, or evidence", () => {
  for (const invalid of [{ ...base, reason: "" }, { ...base, methodVersion: "" }, { ...base, stageRunId: "" }, { ...base, occurredAt: "" }, { ...base, evidenceRefs: [] }]) {
    assert.throws(() => createPulseCandidateOutcome(invalid));
  }
});
