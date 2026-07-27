import assert from "node:assert/strict";
import test from "node:test";
import {
  DERIVATION_VERSION_SCHEMA,
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
  type DerivationVersionEnvelope,
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

test("derivation keys survive PostgreSQL jsonb object-key reordering", () => {
  const original = buildDerivationVersionEnvelope({
    methodology: versioned("method/v1"),
    algorithm: versioned("algorithm/v1"),
    prompt: notApplicable("No prompt."),
    taxonomy: versioned("taxonomy/v1"),
    sourceIds: ["source-b", "source-a"],
  });
  const jsonbShaped: DerivationVersionEnvelope = {
    algorithm: { id: "algorithm/v1", state: "versioned" },
    methodology: { id: "method/v1", state: "versioned" },
    prompt: { reason: "No prompt.", state: "not_applicable" },
    schemaVersion: DERIVATION_VERSION_SCHEMA,
    sourceBasket: {
      id:
        original.sourceBasket.state === "versioned"
          ? original.sourceBasket.id
          : "",
      state: "versioned",
    },
    sourceIds: [...original.sourceIds],
    taxonomy: { id: "taxonomy/v1", state: "versioned" },
  };
  assert.equal(
    derivationVersionKey(jsonbShaped),
    derivationVersionKey(original),
  );

  const withExtra = {
    ...jsonbShaped,
    unexpected: "must not be normalized away",
  } as unknown as DerivationVersionEnvelope;
  assert.throws(
    () => derivationVersionKey(withExtra),
    /unsupported field unexpected/,
  );

  const missing = { ...jsonbShaped } as Partial<DerivationVersionEnvelope>;
  delete missing.prompt;
  assert.throws(
    () => derivationVersionKey(missing as DerivationVersionEnvelope),
    /prompt is missing/,
  );

  const wrongType = {
    ...jsonbShaped,
    taxonomy: { state: "versioned", id: 7 },
  } as unknown as DerivationVersionEnvelope;
  assert.throws(
    () => derivationVersionKey(wrongType),
    /taxonomy has a blank version id/,
  );

  const changed = {
    ...jsonbShaped,
    taxonomy: { state: "versioned" as const, id: "taxonomy/v2" },
  };
  assert.notEqual(
    derivationVersionKey(changed),
    derivationVersionKey(original),
  );
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
