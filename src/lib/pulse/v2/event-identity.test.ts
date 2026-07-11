import assert from "node:assert/strict";
import test from "node:test";
import {
  compareEventIdentities,
  normalizeEventIdentity,
  PULSE_EVENT_IDENTITY_VERSION,
} from "./event-identity";

test("event identity normalization is deterministic and language-normalizing", () => {
  const english = normalizeEventIdentity("Mexico court annuls Oaxaca election");
  const spanish = normalizeEventIdentity(
    "Tribunal de México anula elección Oaxaca",
  );
  assert.equal(english.version, PULSE_EVENT_IDENTITY_VERSION);
  assert.equal(english.key, spanish.key);
  assert.deepEqual(english.tokens, [
    "annul",
    "court",
    "election",
    "mexico",
    "oaxaca",
  ]);
});

test("event anchors distinguish similar incidents", () => {
  const oaxaca = normalizeEventIdentity("Mexico court annuls Oaxaca election");
  const puebla = normalizeEventIdentity("Mexico court annuls Puebla election");
  const comparison = compareEventIdentities(oaxaca, puebla);
  assert.equal(comparison.exactNormalizedMatch, false);
  assert.equal(comparison.hasIdentityAnchor, false);
});
