import assert from "node:assert/strict";
import test from "node:test";

import type { RawEventInput } from "./types";
import {
  buildPulseEvidenceIdentity,
  evidenceLanguage,
  pulseEvidenceSha256,
} from "./evidence-identity";

const row: RawEventInput = {
  sourceId: "gdelt",
  externalId: "fixture-1",
  sourceUrl: "https://example.test/story",
  sourceType: "news",
  jurisdictionId: "11111111-1111-4111-8111-111111111111",
  rawCountryName: "Japan",
  eventDate: "2026-07-10",
  title: "Fixture event",
  body: "Fixture evidence body",
  raw: { language: "English", domain: "example.test", nested: { b: 2, a: 1 } },
};

test("evidence identity is deterministic, complete, and rights-safe", () => {
  const retrievedAt = new Date("2026-07-11T12:00:00.000Z");
  const first = buildPulseEvidenceIdentity(row, retrievedAt);
  const second = buildPulseEvidenceIdentity(
    {
      ...row,
      raw: {
        nested: { a: 1, b: 2 },
        domain: "example.test",
        language: "English",
      },
    },
    retrievedAt,
  );
  assert.deepEqual(first, second);
  assert.match(
    first.evidenceIdentityKey,
    /^pulse-evidence\/sha256:[a-f0-9]{64}$/,
  );
  assert.match(first.evidenceContentHash, /^[a-f0-9]{64}$/);
  assert.equal(first.evidenceLanguage, "en");
  assert.equal(first.evidencePublisher.itemPublisherHost, "example.test");
  assert.equal(first.evidenceAttribution.status, "resolved");
  assert.equal(first.evidenceRights.reviewStatus, "pending");
  assert.equal(first.evidenceRetention.publicPayloadDistribution, "blocked");
});

test("content, retrieval time, and attribution changes produce new identities", () => {
  const stamp = new Date("2026-07-11T12:00:00.000Z");
  const baseline = buildPulseEvidenceIdentity(row, stamp);
  assert.notEqual(
    buildPulseEvidenceIdentity({ ...row, body: "Changed evidence" }, stamp)
      .evidenceIdentityKey,
    baseline.evidenceIdentityKey,
  );
  assert.notEqual(
    buildPulseEvidenceIdentity(row, new Date("2026-07-11T12:00:01.000Z"))
      .evidenceIdentityKey,
    baseline.evidenceIdentityKey,
  );
  assert.notEqual(
    buildPulseEvidenceIdentity({ ...row, jurisdictionId: null }, stamp)
      .evidenceIdentityKey,
    baseline.evidenceIdentityKey,
  );
});

test("unknown language remains explicit and unknown sources fail closed", () => {
  assert.equal(evidenceLanguage({}), "und");
  assert.equal(evidenceLanguage({ language: "not a language code" }), "und");
  assert.throws(
    () =>
      buildPulseEvidenceIdentity(
        { ...row, sourceId: "unregistered" },
        new Date(),
      ),
    /no complete source-input and rights contract/,
  );
});

test("canonical hashing ignores object key order", () => {
  assert.equal(
    pulseEvidenceSha256({ b: 2, a: 1 }),
    pulseEvidenceSha256({ a: 1, b: 2 }),
  );
});
