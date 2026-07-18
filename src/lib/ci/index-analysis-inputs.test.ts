import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readProtectedIndexAnalysisInputs,
  retainProtectedIndexAnalysisInputs,
  type IndexAnalysisInputs,
} from "./index-analysis-inputs";

const fixture: IndexAnalysisInputs = {
  schemaVersion: "civica-index-analysis-inputs/v1",
  panel: [
    {
      jurisdictionId: "jurisdiction-a",
      iso3: "AAA",
      periodYear: 2024,
      dimension: "rule_of_law",
      sourceId: "worldbank_wgi",
      indicatorId: "rl.est",
      value: 0.5,
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
    },
  ],
  uncertainty: [
    {
      jurisdictionId: "jurisdiction-a",
      iso3: "AAA",
      periodYear: 2024,
      dimension: "rule_of_law",
      sourceId: "worldbank_wgi",
      indicatorId: "rl.est",
      value: 0.5,
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
      lower: 0.2,
      upper: 0.8,
    },
  ],
  longitudinalLabels: [{ iso3: "AAA", year: 2022, value: 1 }],
  metadata: [{ iso3: "AAA", region: "Test", regime: null }],
};

test("Index analysis replay accepts only its exact retained protected snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "civica-index-analysis-input-"));
  try {
    const retained = retainProtectedIndexAnalysisInputs(fixture, directory);
    assert.deepEqual(readProtectedIndexAnalysisInputs(retained.contentSha256, directory), fixture);
    writeFileSync(
      retained.path,
      `${readFileSync(retained.path, "utf8").replace("\"AAA\"", "\"AAB\"")}`,
    );
    assert.throws(
      () => readProtectedIndexAnalysisInputs(retained.contentSha256, directory),
      /retained Index analysis input hash drift/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Index analysis replay fails closed without a protected input cache", () => {
  assert.throws(
    () => readProtectedIndexAnalysisInputs("a".repeat(64), ""),
    /Missing protected Index analysis input cache/,
  );
});
