import assert from "node:assert/strict";
import test from "node:test";
import { legacyDerivationVersionEnvelope } from "@/lib/research/derivation-version";
import {
  PULSE_CLASSIFIER_PROMPT_VERSION,
  pulseDeltaVersionEnvelope,
  pulseEventVersionEnvelope,
} from "./versioning";

test("current event envelopes retain current prompt and normalized sources", () => {
  const { envelope } = pulseEventVersionEnvelope(["gdelt", "civicus_monitor", "gdelt"]);
  assert.deepEqual(envelope.sourceIds, ["civicus_monitor", "gdelt"]);
  assert.deepEqual(envelope.prompt, {
    state: "versioned",
    id: PULSE_CLASSIFIER_PROMPT_VERSION,
  });
});

test("delta envelopes preserve legacy input axes instead of guessing current versions", () => {
  const legacy = legacyDerivationVersionEnvelope("Historical event predates DAT-010.");
  const { envelope } = pulseDeltaVersionEnvelope([legacy], ["gdelt"]);
  assert.equal(envelope.methodology.state, "legacy_unversioned");
  assert.equal(envelope.prompt.state, "legacy_unversioned");
  assert.equal(envelope.taxonomy.state, "legacy_unversioned");
  assert.equal(envelope.algorithm.state, "versioned");
});

test("zero-delta rows mark input-only axes and source basket not applicable", () => {
  const { envelope } = pulseDeltaVersionEnvelope([], []);
  assert.equal(envelope.methodology.state, "versioned");
  assert.equal(envelope.algorithm.state, "versioned");
  assert.equal(envelope.prompt.state, "not_applicable");
  assert.equal(envelope.taxonomy.state, "not_applicable");
  assert.equal(envelope.sourceBasket.state, "not_applicable");
});
