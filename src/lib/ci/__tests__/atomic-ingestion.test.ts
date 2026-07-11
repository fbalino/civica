import assert from "node:assert/strict";
import test from "node:test";
import { canonicalStageChecksum, MINIMUM_CI_STAGE_COVERAGE, REQUIRED_CI_ADAPTERS, validateStagedCiRelease, type StagedCiAdapter } from "../atomic-ingestion";

function stages(): StagedCiAdapter[] {
  return REQUIRED_CI_ADAPTERS.map((adapterKey, index) => {
    const [sourceId, dimension] = adapterKey.split(":") as [string, StagedCiAdapter["dimension"]];
    const rows = Array.from({ length: MINIMUM_CI_STAGE_COVERAGE[adapterKey] }, (_, rowIndex) => ({ jurisdictionId: `j${index}-${rowIndex}`, iso3: `AA${String.fromCharCode(65 + (rowIndex % 26))}`, normalizedScore: 50, rawValue: 50, sourceId, dimension, quarter: "2024-Q4", methodologyVersion: "ci-v2-beta", derivationVersionKey: "v1", derivationVersions: { schemaVersion: "fixture" } }));
    return {
      schemaVersion: "ci-atomic-stage/v1", adapterKey, sourceId, dimension,
      datasetYear: 2024, quarter: "2024-Q4", methodologyVersion: "ci-v2-beta",
      nativeScaleMin: 0, nativeScaleMax: 100, isInverted: false,
      globalMinObserved: 0, globalMaxObserved: 100, countriesCovered: rows.length, skipped: 0,
      rows,
    };
  });
}

test("a complete nonoverlapping staged release validates", () => {
  assert.deepEqual(validateStagedCiRelease(stages()), []);
});

test("missing adapter, metadata drift, empty coverage, and overlap fail closed", () => {
  assert.match(validateStagedCiRelease(stages().slice(1)).join(" "), /adapter set/);
  const drift = stages(); drift[0].quarter = "2025-Q1";
  assert.match(validateStagedCiRelease(drift).join(" "), /disagree|metadata drift/);
  const empty = stages(); empty[0].rows = []; empty[0].countriesCovered = 0;
  assert.match(validateStagedCiRelease(empty).join(" "), /empty/);
  const overlap = stages(); overlap[1].rows[0].jurisdictionId = overlap[0].rows[0].jurisdictionId; overlap[1].rows[0].dimension = overlap[0].rows[0].dimension;
  assert.match(validateStagedCiRelease(overlap).join(" "), /overlapping/);
});

test("stage checksum is stable across adapter and row order", () => {
  const first = stages();
  const second = [...first].reverse().map((stage) => ({ ...stage, rows: [...stage.rows].reverse() }));
  assert.equal(canonicalStageChecksum(first), canonicalStageChecksum(second));
});
