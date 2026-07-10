import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SOURCE_INPUT_SPECS,
  buildVersionedSourceInputManifest,
  frozenIndexInputCaptures,
  missingReleaseCaptures,
  productionPipelineContracts,
  validateSourceInputContract,
} from "../source-input-manifest";

test("all deployed pipelines and sources form a closed manifest contract", () => {
  assert.equal(productionPipelineContracts().length, 45);
  assert.equal(SOURCE_INPUT_SPECS.length, 43);
  assert.deepEqual(validateSourceInputContract(), []);
});

test("the frozen Index manifest carries every required reproducibility field", () => {
  const manifest = buildVersionedSourceInputManifest(
    "ci-beta-2024-Q4",
    ["index.current-beta"],
    frozenIndexInputCaptures(),
  );
  assert.equal(manifest.inputs.length, 4);
  for (const input of manifest.inputs) {
    assert.match(input.contentSha256, /^[a-f0-9]{64}$/);
    assert.match(input.adapterVersion, /^sha256:[a-f0-9]{64}$/);
    assert.ok(Date.parse(input.retrievedAt));
    assert.ok(input.accessUrl.startsWith("https://"));
    assert.ok(input.upstreamVersion);
    assert.ok(input.upstreamVintage);
    assert.ok(input.expectedCoverage);
    assert.ok(input.redistributionPosture);
  }
});

test("release generation fails closed when one required input is absent", () => {
  const captures = frozenIndexInputCaptures().slice(1);
  assert.deepEqual(missingReleaseCaptures(["index.current-beta"], captures), [
    "index.current-beta:vdem",
  ]);
  assert.throws(
    () =>
      buildVersionedSourceInputManifest(
        "ci-beta-2024-Q4",
        ["index.current-beta"],
        captures,
      ),
    /missing-capture:index\.current-beta:vdem/,
  );
});

test("bad hashes, times, and source/pipeline relationships are rejected", () => {
  const [capture] = frozenIndexInputCaptures();
  const issues = validateSourceInputContract([
    {
      ...capture,
      sourceId: "not_in_pipeline",
      retrievedAt: "not-a-date",
      contentSha256: "bad",
      adapterVersion: "working-tree",
      accessUrl: "not-a-url",
    },
  ]);
  assert.deepEqual(
    new Set(issues.map((issue) => issue.code)),
    new Set([
      "capture-source-not-in-pipeline",
      "capture-source-without-spec",
      "invalid-content-hash",
      "invalid-adapter-version",
      "invalid-retrieval-time",
      "invalid-access-url",
    ]),
  );
});
