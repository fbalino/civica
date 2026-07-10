import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRawRetentionManifest,
  rawRetentionErrors,
} from "../raw-snapshot-manifest";

test("closes the one named frozen release over four captures and five value groups", () => {
  const manifest = buildRawRetentionManifest();
  assert.equal(manifest.releaseId, "ci-beta-2024-Q4");
  assert.equal(manifest.captures.length, 4);
  assert.equal(manifest.releasedValueGroups.length, 5);
  assert.deepEqual(rawRetentionErrors(manifest), []);
});

test("every value group resolves to its exact source capture", () => {
  const manifest = buildRawRetentionManifest();
  const captures = new Map(manifest.captures.map((capture) => [capture.captureId, capture]));
  for (const group of manifest.releasedValueGroups) {
    assert.equal(captures.get(group.rawCaptureId)?.sourceId, group.sourceId);
  }
});

test("publisher bytes remain excluded while reconstruction binds the exact hash", () => {
  const manifest = buildRawRetentionManifest();
  for (const capture of manifest.captures) {
    assert.equal(capture.publisherPayloadIncluded, false);
    assert.match(capture.reconstruction.byteVerification, new RegExp(capture.contentSha256));
    assert.match(capture.reconstruction.mismatchPolicy, /Stop/);
  }
});

test("detects missing raw lineage for a released group", () => {
  const manifest = structuredClone(buildRawRetentionManifest());
  manifest.releasedValueGroups[0].rawCaptureId = "missing:capture";
  assert.match(rawRetentionErrors(manifest).join(" "), /missing raw capture/);
});

test("detects a mutated byte hash and manifest hash", () => {
  const manifest = structuredClone(buildRawRetentionManifest());
  manifest.captures[0].contentSha256 = "0".repeat(64);
  const errors = rawRetentionErrors(manifest).join(" ");
  assert.match(errors, /manifest hash does not match/);
  assert.match(errors, /reconstruction does not bind/);
});

test("detects release semantic-checksum or row-count corruption", () => {
  const manifest = structuredClone(buildRawRetentionManifest());
  manifest.releasedValueGroups[0].semanticSha256 = "bad";
  manifest.releasedValueGroups[1].expectedRows = 0;
  const errors = rawRetentionErrors(manifest).join(" ");
  assert.match(errors, /invalid semantic hash/);
  assert.match(errors, /invalid expected row count/);
});

test("detects a mutable/non-HTTPS acquisition record", () => {
  const manifest = structuredClone(buildRawRetentionManifest());
  manifest.captures[0].accessUrl = "http://example.test/latest";
  manifest.captures[0].retrievedAt = "not-a-time";
  const errors = rawRetentionErrors(manifest).join(" ");
  assert.match(errors, /non-HTTPS/);
  assert.match(errors, /invalid retrieval time/);
});
