import assert from "node:assert/strict";
import { test } from "node:test";

import { SOURCE_INPUT_SPECS } from "../../data/source-input-manifest";
import {
  PRODUCT_RIGHTS,
  RELEASE_ARTIFACT_RIGHTS,
  RIGHTS_MANIFEST_VERSION,
  SOURCE_RIGHTS,
  buildRightsManifest,
  evaluatePublicExport,
} from "../manifest";

test("every production source has exactly one rights record", () => {
  assert.equal(SOURCE_RIGHTS.length, SOURCE_INPUT_SPECS.length);
  assert.deepEqual(
    SOURCE_RIGHTS.map((record) => record.sourceId).sort(),
    SOURCE_INPUT_SPECS.map((record) => record.sourceId).sort(),
  );
});

test("only verified source records can permit public export", () => {
  for (const record of SOURCE_RIGHTS) {
    if (record.publicExport === "allowed") {
      assert.equal(record.reviewStatus, "verified", record.sourceId);
      assert.ok(record.reviewedAt, record.sourceId);
      assert.equal(record.commercialUse, true, record.sourceId);
      assert.equal(record.derivatives, true, record.sourceId);
    }
    if (record.reviewStatus === "pending") {
      assert.notEqual(record.publicExport, "allowed", record.sourceId);
    }
  }
});

test("the country export permits verified sources and blocks pending ones", () => {
  const decision = evaluatePublicExport("country-export-json-csv", [
    "cia_factbook",
    "wikidata",
  ]);
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.blockedSources, []);
  const blocked = evaluatePublicExport("country-export-json-csv", ["vdem"]);
  assert.equal(blocked.allowed, false);
  assert.deepEqual(blocked.blockedSources, ["vdem"]);
});

test("unknown products and pending sources fail closed", () => {
  assert.equal(evaluatePublicExport("unknown", ["wikidata"]).allowed, false);
  const decision = evaluatePublicExport("index-bulk-release", [
    "freedom_house",
    "worldbank_wgi",
  ]);
  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockedSources, ["freedom_house"]);
});

test("release artifacts name included and excluded publisher payloads", () => {
  assert.equal(RELEASE_ARTIFACT_RIGHTS.length, 3);
  const metadataArtifacts = RELEASE_ARTIFACT_RIGHTS.filter(
    (artifact) => artifact.artifactKind === "metadata-only",
  );
  assert.equal(metadataArtifacts.length, 2);
  for (const artifact of metadataArtifacts) {
    assert.equal(artifact.artifactKind, "metadata-only");
    assert.equal(artifact.publicDistribution, "allowed");
    assert.deepEqual(artifact.includedSources, artifact.excludedSourcePayloads);
  }
  const atlas = RELEASE_ARTIFACT_RIGHTS.find(
    (artifact) => artifact.releaseId === "atlas-2026-07-11",
  );
  assert.equal(atlas?.artifactKind, "data");
  assert.equal(atlas?.publicDistribution, "allowed");
  assert.deepEqual(atlas?.includedSources, [
    "cia_factbook",
    "wikidata",
    "world_bank",
  ]);
  assert.ok((atlas?.excludedSourcePayloads.length ?? 0) > 0);
});

test("machine-readable manifest contains source, product, field, and release levels", () => {
  const manifest = buildRightsManifest();
  assert.equal(manifest.schemaVersion, RIGHTS_MANIFEST_VERSION);
  assert.equal(manifest.sources.length, 43);
  assert.equal(manifest.products, PRODUCT_RIGHTS);
  assert.equal(manifest.releaseArtifacts, RELEASE_ARTIFACT_RIGHTS);
  assert.ok(manifest.products.every((product) => product.fields.length > 0));
});
