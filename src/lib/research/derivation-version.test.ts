import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDerivationVersionEnvelope,
  contentVersion,
  derivationVersionErrors,
  derivationVersionKey,
  legacyDerivationVersionEnvelope,
  matchesVersion,
  notApplicable,
  sourceBasketVersion,
  versioned,
  versionSetId,
} from "./derivation-version";

const current = () =>
  buildDerivationVersionEnvelope({
    methodology: versioned("method/v1"),
    algorithm: versioned("algorithm/v2"),
    prompt: notApplicable("Deterministic transform."),
    taxonomy: versioned("taxonomy/v3"),
    sourceIds: ["wikidata", "cia_factbook", "wikidata"],
  });

test("normalizes and hashes source baskets deterministically", () => {
  assert.deepEqual(sourceBasketVersion(["wikidata", " cia_factbook ", "wikidata"]), sourceBasketVersion(["cia_factbook", "wikidata"]));
});

test("content versions change with content", () => {
  assert.notEqual(contentVersion("prompt", "one"), contentVersion("prompt", "two"));
});

test("new envelopes require explicit nonlegacy axes", () => {
  const envelope = current();
  assert.deepEqual(derivationVersionErrors(envelope, { allowLegacy: false }), []);
  assert.deepEqual(envelope.sourceIds, ["cia_factbook", "wikidata"]);
});

test("legacy backfills remain explicit and valid only when allowed", () => {
  const legacy = legacyDerivationVersionEnvelope("Predates DAT-010.");
  assert.deepEqual(derivationVersionErrors(legacy), []);
  assert.ok(derivationVersionErrors(legacy, { allowLegacy: false }).length >= 5);
});

test("rejects a versioned source basket without source ids", () => {
  const envelope = current();
  envelope.sourceIds = [];
  assert.match(derivationVersionErrors(envelope).join(" "), /requires at least one source id/);
});

test("allows an explicit not-applicable source basket for empty derived state", () => {
  const envelope = buildDerivationVersionEnvelope({
    methodology: versioned("method/v1"),
    algorithm: versioned("algorithm/v1"),
    prompt: notApplicable("No prompt."),
    taxonomy: notApplicable("No taxonomy."),
    sourceBasket: notApplicable("No active inputs."),
    sourceIds: [],
  });
  assert.deepEqual(derivationVersionErrors(envelope, { allowLegacy: false }), []);
});

test("derivation keys are stable and change on an axis change", () => {
  const first = current();
  const same = current();
  const changed = { ...current(), algorithm: versioned("algorithm/v3") };
  assert.equal(derivationVersionKey(first), derivationVersionKey(same));
  assert.notEqual(derivationVersionKey(first), derivationVersionKey(changed));
});

test("matches a requested version axis exactly", () => {
  const envelope = current();
  assert.equal(matchesVersion(envelope, "methodology", "method/v1"), true);
  assert.equal(matchesVersion(envelope, "algorithm", "method/v1"), false);
  assert.equal(matchesVersion(envelope, "prompt", "anything"), false);
});

test("version sets preserve a sole version and hash mixed versions", () => {
  assert.equal(versionSetId("set", ["v1", "v1"]), "v1");
  assert.match(versionSetId("set", ["v2", "v1"]), /^set\/sha256:/);
});

test("blank version ids and reasons fail closed", () => {
  assert.throws(() => versioned(" "));
  assert.throws(() => notApplicable(" "));
  assert.throws(() => sourceBasketVersion([]));
});

test("a new downstream row may preserve an explicit legacy input axis without guessing", () => {
  const legacy = legacyDerivationVersionEnvelope("Input predates row-level versioning.");
  const envelope = buildDerivationVersionEnvelope({
    methodology: legacy.methodology,
    algorithm: versioned("current-downstream-algorithm/v1"),
    prompt: legacy.prompt,
    taxonomy: legacy.taxonomy,
    sourceIds: ["wikidata"],
    allowLegacyInputAxes: true,
  });
  assert.equal(envelope.methodology.state, "legacy_unversioned");
  assert.deepEqual(derivationVersionErrors(envelope), []);
});
