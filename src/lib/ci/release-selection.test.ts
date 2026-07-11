import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ciReleaseContractErrors,
  displayCiReleaseDimensionScore,
  resolveCiRelease,
  selectCiReleaseDimensionRows,
} from "./release-selection";

function row(releaseId: string, jurisdictionId: string, dimension: string, sourceId: string, indicatorId: string, rawValue: number) {
  const release = resolveCiRelease(releaseId);
  const rule = release.dimensions.find((item) => item.dimension === dimension && item.sourceId === sourceId && item.indicatorId === indicatorId)!;
  return {
    jurisdictionId, dimension, sourceId, indicatorId, rawValue, normalizedScore: 50,
    quarter: release.quarter, methodologyVersion: release.methodologyVersion,
    transformationId: `${release.inputTransformationVersion}:${dimension}`,
    methodVersion: release.methodologyVersion, artifactHash: rule.artifactSha256,
  };
}

test("release registry is closed and current coordinates are pinned", () => {
  assert.deepEqual(ciReleaseContractErrors(), []);
  assert.equal(resolveCiRelease().releaseId, "ci-beta-r5-2024-Q4");
});

test("overlapping Beta-R4 and Beta-R5 rows reproduce only the requested release", () => {
  const rows = [
    row("ci-beta-r4-2024-Q4", "japan", "rule_of_law", "worldbank_wgi", "rl.est", 0.9),
    row("ci-beta-r5-2024-Q4", "japan", "rule_of_law", "worldbank_wgi", "rl.est", 1.1),
    row("ci-beta-r4-2024-Q4", "japan", "corruption_control", "transparency_intl", "CPI_SCORE", 71),
    row("ci-beta-r5-2024-Q4", "japan", "corruption_control", "transparency_intl", "CPI_SCORE", 73),
  ];
  const r4 = selectCiReleaseDimensionRows(rows, "ci-beta-r4-2024-Q4");
  const r5 = selectCiReleaseDimensionRows(rows, "ci-beta-r5-2024-Q4");
  assert.deepEqual(r4.map((item) => item.rawValue), [71, 0.9]);
  assert.deepEqual(r5.map((item) => item.rawValue), [73, 1.1]);
  assert.ok(r4.every((item) => item.methodologyVersion === "beta-r4"));
  assert.ok(r5.every((item) => item.methodologyVersion === "beta-r5"));
});

test("V-Dem wins the declared democracy fallback without row-order dependence", () => {
  const primary = row("ci-beta-r5-2024-Q4", "japan", "democratic_quality", "vdem", "v2x_libdem", 0.8);
  const fallback = row("ci-beta-r5-2024-Q4", "japan", "democratic_quality", "worldbank_wgi", "va.est", 1.2);
  assert.equal(selectCiReleaseDimensionRows([fallback, primary])[0].sourceId, "vdem");
  assert.equal(selectCiReleaseDimensionRows([primary, fallback])[0].sourceId, "vdem");
});

test("unknown identity, artifact, transform, and display-version mixing fail closed", () => {
  const valid = row("ci-beta-r5-2024-Q4", "japan", "rule_of_law", "worldbank_wgi", "rl.est", 1.1);
  for (const mutation of [
    { indicatorId: "va.est" },
    { artifactHash: "a".repeat(64) },
    { transformationId: "legacy-transform" },
    { methodVersion: "beta-r4" },
  ]) {
    assert.throws(() => selectCiReleaseDimensionRows([{ ...valid, ...mutation }]));
    assert.throws(() => displayCiReleaseDimensionScore({ ...valid, ...mutation }));
  }
  assert.equal(displayCiReleaseDimensionScore(valid), 72);
});
