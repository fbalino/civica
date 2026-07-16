import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CiReleaseConsistencyError,
  assertCiReleaseMethodologyRecord,
  assertCiReleaseCompositeRow,
  ciReleaseContractErrors,
  displayCiReleaseDimensionScore,
  resolveCiRelease,
  selectCiReleaseDimensionRows,
} from "./release-selection";
import { ciVersionEnvelope } from "./versioning";
import { indexContentHash } from "../data/frozen-vintage";

function row(releaseId: string, jurisdictionId: string, dimension: string, sourceId: string, indicatorId: string, rawValue: number) {
  const release = resolveCiRelease(releaseId);
  const rule = release.dimensions.find((item) => item.dimension === dimension && item.sourceId === sourceId && item.indicatorId === indicatorId)!;
  const derivation = ciVersionEnvelope({
    methodologyVersion: release.methodologyVersion,
    algorithmVersion: release.inputTransformationVersion,
    sourceIds: [sourceId],
  });
  return {
    releaseId: release.releaseId, jurisdictionId, dimension, sourceId, indicatorId, rawValue, normalizedScore: 50,
    quarter: release.quarter, methodologyVersion: release.methodologyVersion,
    transformationId: `${release.inputTransformationVersion}:${dimension}`,
    methodVersion: release.methodologyVersion, artifactHash: rule.artifactSha256,
    upstreamRelease: rule.upstreamRelease,
    artifactKind: rule.artifactKind,
    temporalCoverage: rule.temporalCoverage,
    licenseUrl: rule.licenseUrl,
    substitutionReason: rule.substitutionReason,
    derivationVersionKey: derivation.key,
    derivationVersions: derivation.envelope,
  };
}

function composite(releaseId: string) {
  const release = resolveCiRelease(releaseId);
  const derivation = ciVersionEnvelope({
    methodologyVersion: release.methodologyVersion,
    algorithmVersion: release.compositeAlgorithmVersion,
    sourceIds: [
      "freedom_house",
      "transparency_intl",
      "vdem",
      "worldbank_wgi",
    ],
  });
  const value = {
    releaseId: release.releaseId,
    jurisdictionId: "japan",
    quarter: release.quarter,
    score: 80,
    scoreLower: release.uncertainty.bounds === "required" ? 75 : null,
    scoreUpper: release.uncertainty.bounds === "required" ? 85 : null,
    completenessFlag: "full",
    vintageLabel: release.vintageLabel,
    supersedesVintageLabel: release.supersedesVintageLabel,
    rank: 1,
    totalRanked: release.compositeRowSet.rows,
    isPartial: false,
    dimensionsAvailable: 4,
    missingDimensions: [],
    methodologyVersion: release.methodologyVersion,
    derivationVersionKey: derivation.key,
    derivationVersions: derivation.envelope,
    contentHash: null as string | null,
  };
  value.contentHash = indexContentHash(value);
  return value;
}

test("release registry is closed and current coordinates are pinned", () => {
  assert.deepEqual(ciReleaseContractErrors(), []);
  assert.equal(resolveCiRelease().releaseId, "ci-beta-r5-2024-Q4");
});

test("release methodology content is hash-bound, not identified by label alone", () => {
  const valid = {
    id: "beta-r5",
    weights: {
      democratic_quality: 0.27,
      rule_of_law: 0.26,
      freedom_rights: 0.23,
      corruption_control: 0.24,
    },
  };
  assert.equal(
    assertCiReleaseMethodologyRecord(valid, "ci-beta-r5-2024-Q4"),
    valid,
  );
  assert.throws(
    () =>
      assertCiReleaseMethodologyRecord(
        {
          ...valid,
          weights: { ...valid.weights, democratic_quality: 0.28 },
        },
        "ci-beta-r5-2024-Q4",
      ),
    CiReleaseConsistencyError,
  );
});

test("composites bind supersession and release-specific uncertainty", () => {
  const r3 = composite("ci-beta-r3-2024-Q4");
  const r5 = composite("ci-beta-r5-2024-Q4");
  assert.equal(assertCiReleaseCompositeRow(r3, r3.releaseId), r3);
  assert.equal(assertCiReleaseCompositeRow(r5, r5.releaseId), r5);
  assert.throws(
    () =>
      assertCiReleaseCompositeRow(
        { ...r5, supersedesVintageLabel: null },
        r5.releaseId,
      ),
    CiReleaseConsistencyError,
  );
  assert.throws(
    () =>
      assertCiReleaseCompositeRow(
        { ...r5, scoreLower: 70, scoreUpper: 90 },
        r5.releaseId,
      ),
    CiReleaseConsistencyError,
  );
  assert.throws(
    () =>
      assertCiReleaseCompositeRow(
        { ...r3, scoreLower: null, scoreUpper: null },
        r3.releaseId,
      ),
    CiReleaseConsistencyError,
  );
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
    { upstreamRelease: "mutable latest" },
    { artifactKind: "normalized_batch" },
    { temporalCoverage: "2025" },
    { licenseUrl: "https://example.test/terms" },
    { substitutionReason: "invented fallback" },
    { derivationVersionKey: "a".repeat(64) },
    {
      derivationVersions: {
        ...valid.derivationVersions,
        algorithm: { state: "versioned" as const, id: "legacy-transform" },
      },
    },
  ]) {
    assert.throws(
      () => selectCiReleaseDimensionRows([{ ...valid, ...mutation }]),
      CiReleaseConsistencyError,
    );
    assert.throws(
      () => displayCiReleaseDimensionScore({ ...valid, ...mutation }),
      CiReleaseConsistencyError,
    );
  }
  assert.equal(displayCiReleaseDimensionScore(valid), 72);
});
