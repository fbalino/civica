import assert from "node:assert/strict";
import test from "node:test";
import { assertReferenceYear, temporalMetadataErrors } from "./temporal-metadata";

const br = { observationReferenceYear: 2022, upstreamDatasetRelease: "Bjørnskov-Rode regime data v6.1 via QoG Standard Jan26", retrievedAt: "2026-04-22T04:01:13.289Z", civicaPublicationVersion: "2026_v1" };

test("the four temporal dimensions remain separately valid", () => assert.deepEqual(temporalMetadataErrors(br), []));
test("BR/CGV ingestion year cannot masquerade as its reference year", () => {
  assert.doesNotThrow(() => assertReferenceYear(br, 2022, "BR/CGV cross-section"));
  assert.throws(() => assertReferenceYear({ ...br, observationReferenceYear: 2025 }, 2022, "BR/CGV cross-section"), /must be 2022, not 2025/);
});
test("retrieval and version fields fail on malformed labels", () => {
  assert.deepEqual(temporalMetadataErrors({ ...br, retrievedAt: "Jan someday", civicaPublicationVersion: "" }), ["invalid retrieval time", "blank Civica publication version"]);
});
