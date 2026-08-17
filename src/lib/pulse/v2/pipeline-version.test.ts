import assert from "node:assert/strict";
import test from "node:test";

import {
  ADOPTED_PULSE_RESEARCH_ONTOLOGY_VERSION,
  PULSE_PIPELINE_STAGES,
  PULSE_PIPELINE_VERSION,
  buildPulseStageVersionEnvelope,
  legacyPulseStageVersionEnvelope,
  pulseCronStageRunId,
  pulseStageVersionErrors,
  pulseStageVersionKey,
  summarizePulseVersionSet,
} from "./pipeline-version";

test("one cron delivery derives stable, stage-specific Pulse run ids", () => {
  const delivery = "a".repeat(64);
  const retry = pulseCronStageRunId(delivery, "corroborate");
  assert.equal(retry, pulseCronStageRunId(delivery, "corroborate"));
  assert.notEqual(retry, pulseCronStageRunId(delivery, "score"));
  assert.notEqual(
    retry,
    pulseCronStageRunId("b".repeat(64), "corroborate"),
  );
  assert.match(
    retry,
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  assert.throws(() => pulseCronStageRunId("spoof", "score"));
});

test("every Pulse stage receives a complete immutable version identity", () => {
  for (const stage of PULSE_PIPELINE_STAGES) {
    const envelope = buildPulseStageVersionEnvelope(stage);
    assert.deepEqual(pulseStageVersionErrors(envelope), [], stage);
    assert.equal(envelope.methodology.state, "versioned");
    assert.equal(envelope.ontology.state, "versioned");
    assert.deepEqual(envelope.pipeline, {
      state: "versioned",
      id: PULSE_PIPELINE_VERSION,
    });
    assert.equal(envelope.sourceBasket.state, "versioned");
    assert.ok(envelope.sourceIds.length > 0);
    assert.match(pulseStageVersionKey(envelope), /^pulse-stage\/sha256:[a-f0-9]{64}$/);
  }
});

test("scheduled classifications name production v2, not adopted research v3", () => {
  const classify = buildPulseStageVersionEnvelope("classify");
  assert.deepEqual(classify.ontology, { state: "versioned", id: "v2.0" });
  assert.equal(ADOPTED_PULSE_RESEARCH_ONTOLOGY_VERSION, "pulse-event-ontology/v3.0");
  assert.notEqual(
    classify.ontology.state === "versioned" ? classify.ontology.id : null,
    ADOPTED_PULSE_RESEARCH_ONTOLOGY_VERSION,
  );
  // pulse-v2.16-beta: four subscription voters (owner panel, 2026-08-17).
  assert.equal(classify.models.filter(({ role }) => role === "classify").length, 4);
  assert.equal(classify.models.filter(({ role }) => role === "verify").length, 1);
  assert.equal(
    classify.models.filter(({ role }) => role === "subject_attribution").length,
    1,
  );
});

test("stage keys are order invariant but drift on a declared axis", () => {
  const first = buildPulseStageVersionEnvelope("score", {
    sourceIds: ["gdelt", "amnesty"],
    upstreamRunIds: ["run-b", "run-a"],
  });
  const reordered = buildPulseStageVersionEnvelope("score", {
    sourceIds: ["amnesty", "gdelt"],
    upstreamRunIds: ["run-a", "run-b"],
  });
  const changed = buildPulseStageVersionEnvelope("score", {
    sourceIds: ["amnesty", "gdelt", "hrw"],
    upstreamRunIds: ["run-a", "run-b"],
  });
  assert.equal(pulseStageVersionKey(first), pulseStageVersionKey(reordered));
  assert.notEqual(pulseStageVersionKey(first), pulseStageVersionKey(changed));
});

test("mixed and legacy rows cannot masquerade as one comparable series", () => {
  const current = buildPulseStageVersionEnvelope("classify");
  const legacy = legacyPulseStageVersionEnvelope("classify");
  const currentKey = pulseStageVersionKey(current);
  const legacyKey = pulseStageVersionKey(legacy);

  assert.deepEqual(
    summarizePulseVersionSet([{ versionKey: currentKey, versions: current }]),
    {
      state: "single_version",
      versionKeys: [currentKey],
      containsLegacy: false,
      comparableAsSingleSeries: true,
    },
  );
  const mixed = summarizePulseVersionSet([
    { versionKey: currentKey, versions: current },
    { versionKey: legacyKey, versions: legacy },
  ]);
  assert.equal(mixed.state, "mixed_version");
  assert.equal(mixed.containsLegacy, true);
  assert.equal(mixed.comparableAsSingleSeries, false);
});
