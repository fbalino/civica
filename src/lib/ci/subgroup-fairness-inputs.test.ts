import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  readProtectedSubgroupFairnessInputs,
  retainProtectedSubgroupFairnessInputs,
  type SubgroupFairnessInputs,
} from "./subgroup-fairness-inputs";

const fixture: SubgroupFairnessInputs = {
  schemaVersion: "civica-index-subgroup-fairness-inputs/v1",
  panel: [
    {
      iso3: "AAA",
      dimension: "rule_of_law",
      sourceId: "worldbank_wgi",
      indicatorId: "rl.est",
      value: 0.5,
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
    },
  ],
  uncertainty: [{ iso3: "AAA", dimension: "rule_of_law", lower: 0.2, upper: 0.8 }],
  media: [{ iso3: "AAA", value: 0.5 }],
  metadata: [
    { iso3: "AAA", region: "Test", population: 1_000, disputed: false, regime: null },
  ],
};

test("subgroup fairness replay accepts only the exact retained protected input", async () => {
  const directory = await mkdtemp(join(tmpdir(), "civica-subgroup-fairness-input-"));
  try {
    const retained = retainProtectedSubgroupFairnessInputs(fixture, directory);
    assert.deepEqual(readProtectedSubgroupFairnessInputs(retained.contentSha256, directory), fixture);
    writeFileSync(retained.path, `${readFileSync(retained.path, "utf8").replace("\"AAA\"", "\"AAB\"")}`);
    assert.throws(
      () => readProtectedSubgroupFairnessInputs(retained.contentSha256, directory),
      /retained subgroup fairness input hash drift/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("subgroup fairness replay fails closed without a protected input cache", () => {
  assert.throws(
    () => readProtectedSubgroupFairnessInputs("a".repeat(64), ""),
    /Missing protected subgroup fairness input cache/,
  );
});
