import assert from "node:assert/strict";
import test from "node:test";

import { indexContentHash } from "../data/frozen-vintage";
import { ciVersionEnvelope } from "./versioning";
import {
  ciCompositeSemanticRowSet,
  ciDimensionSemanticRowSet,
  ciPublicationInventoryErrors,
  ciReproductionManifestErrors,
  ciStagedReleaseHeader,
  type CiPublishedCompositeRow,
  type CiPublishedDimensionRow,
  type CiReproductionManifest,
} from "./release-publication";
import { resolveCiRelease, type CiReleaseContract } from "./release-selection";

function fixture() {
  const base = resolveCiRelease();
  const rules = [
    base.dimensions.find(
      (row) => row.sourceId === "worldbank_wgi" && row.indicatorId === "va.est",
    )!,
    base.dimensions.find(
      (row) => row.sourceId === "worldbank_wgi" && row.indicatorId === "rl.est",
    )!,
    base.dimensions.find((row) => row.sourceId === "freedom_house")!,
  ];
  const dimensions: CiPublishedDimensionRow[] = rules.map((rule, index) => {
    const dimensionVersions = ciVersionEnvelope({
      methodologyVersion: base.methodologyVersion,
      algorithmVersion: base.inputTransformationVersion,
      sourceIds: [rule.sourceId],
    });
    return {
      releaseId: base.releaseId,
      jurisdictionId: "00000000-0000-4000-8000-000000000001",
      iso3: "EXP",
      dimension: rule.dimension,
      sourceId: rule.sourceId,
      indicatorId: rule.indicatorId,
      rawValue: index + 1,
      normalizedScore: 70 - index,
      quarter: base.quarter,
      methodologyVersion: base.methodologyVersion,
      transformationId: `${base.inputTransformationVersion}:${rule.dimension}`,
      methodVersion: base.methodologyVersion,
      artifactHash: rule.artifactSha256,
      upstreamRelease: rule.upstreamRelease,
      artifactKind: rule.artifactKind,
      temporalCoverage: rule.temporalCoverage,
      licenseUrl: rule.licenseUrl,
      substitutionReason: rule.substitutionReason,
      derivationVersionKey: dimensionVersions.key,
      derivationVersions: dimensionVersions.envelope,
    };
  });
  const dimension = dimensions[1];
  const compositeVersions = ciVersionEnvelope({
    methodologyVersion: base.methodologyVersion,
    algorithmVersion: base.compositeAlgorithmVersion,
    sourceIds: ["freedom_house", "worldbank_wgi"],
  });
  const compositeCore = {
    releaseId: base.releaseId,
    jurisdictionId: dimension.jurisdictionId,
    iso3: dimension.iso3,
    quarter: base.quarter,
    score: 70,
    scoreLower: null,
    scoreUpper: null,
    completenessFlag: "partial",
    vintageLabel: base.vintageLabel,
    supersedesVintageLabel: base.supersedesVintageLabel,
    rank: 1,
    totalRanked: 1,
    isPartial: true,
    dimensionsAvailable: 3,
    missingDimensions: ["corruption_control"],
    methodologyVersion: base.methodologyVersion,
    derivationVersionKey: compositeVersions.key,
    derivationVersions: compositeVersions.envelope,
  };
  const composite: CiPublishedCompositeRow = {
    ...compositeCore,
    contentHash: indexContentHash(compositeCore),
  };
  const release: CiReleaseContract = {
    ...base,
    dimensions: rules,
    dimensionRowSet: ciDimensionSemanticRowSet(dimensions),
    compositeRowSet: ciCompositeSemanticRowSet([composite]),
  };
  return { release, dimensions, dimension, composite };
}

test("the staging header binds every immutable release coordinate", () => {
  const { release } = fixture();
  const header = ciStagedReleaseHeader(release);
  assert.equal(header.status, "staging");
  assert.equal(header.id, release.releaseId);
  assert.equal(header.dimensionRowCount, 3);
  assert.equal(header.compositeRowCount, 1);
  assert.deepEqual(Object.keys(header.sourceArtifacts), [
    "freedom_house:fh_pr_cl_sum",
    "worldbank_wgi:rl.est",
    "worldbank_wgi:va.est",
  ]);
});

test("semantic row-set hashes are canonical across database row order", () => {
  const { dimension, composite } = fixture();
  const secondDimension = {
    ...dimension,
    jurisdictionId: "00000000-0000-4000-8000-000000000002",
    iso3: "EXQ",
  };
  const secondCompositeCore = {
    ...composite,
    jurisdictionId: secondDimension.jurisdictionId,
    iso3: secondDimension.iso3,
    score: 60,
    rank: 2,
    totalRanked: 2,
    contentHash: null,
  };
  const secondComposite = {
    ...secondCompositeCore,
    contentHash: indexContentHash(secondCompositeCore),
  };
  const firstComposite = { ...composite, totalRanked: 2 };

  assert.deepEqual(
    ciDimensionSemanticRowSet([dimension, secondDimension]),
    ciDimensionSemanticRowSet([secondDimension, dimension]),
  );
  assert.deepEqual(
    ciCompositeSemanticRowSet([firstComposite, secondComposite]),
    ciCompositeSemanticRowSet([secondComposite, firstComposite]),
  );
});

test("a complete exact release inventory passes and every drift fails closed", () => {
  const { release, dimensions, dimension, composite } = fixture();
  assert.deepEqual(
    ciPublicationInventoryErrors(release, dimensions, [composite]),
    [],
  );

  assert.ok(
    ciPublicationInventoryErrors(
      release,
      dimensions.map((row, index) =>
        index === 0 ? { ...row, artifactHash: "a".repeat(64) } : row,
      ),
      [composite],
    ).some((error) => error.includes("source/indicator/artifact")),
  );
  assert.ok(
    ciPublicationInventoryErrors(
      release,
      dimensions,
      [{ ...composite, releaseId: "ci-wrong-2024-Q4" }],
    ).some((error) => error.includes("release id mismatch")),
  );
  assert.ok(
    ciPublicationInventoryErrors(
      release,
      dimensions,
      [{ ...composite, contentHash: "b".repeat(64) }],
    ).some((error) => error.includes("composite content hash mismatch")),
  );
});

test("a composite cannot claim WGI when priority selection retained V-Dem", () => {
  const { release, dimensions, composite } = fixture();
  const sourceRelease = resolveCiRelease();
  const vdemRule = sourceRelease.dimensions.find(
    (rule) => rule.sourceId === "vdem",
  )!;
  const dimensionVersion = ciVersionEnvelope({
    methodologyVersion: release.methodologyVersion,
    algorithmVersion: release.inputTransformationVersion,
    sourceIds: [vdemRule.sourceId],
  });
  const vdemDimension: CiPublishedDimensionRow = {
    ...dimensions[0],
    dimension: vdemRule.dimension,
    sourceId: vdemRule.sourceId,
    indicatorId: vdemRule.indicatorId,
    artifactHash: vdemRule.artifactSha256,
    upstreamRelease: vdemRule.upstreamRelease,
    artifactKind: vdemRule.artifactKind,
    temporalCoverage: vdemRule.temporalCoverage,
    licenseUrl: vdemRule.licenseUrl,
    substitutionReason: vdemRule.substitutionReason,
    transformationId: `${release.inputTransformationVersion}:${vdemRule.dimension}`,
    derivationVersionKey: dimensionVersion.key,
    derivationVersions: dimensionVersion.envelope,
  };
  const wrongVersion = ciVersionEnvelope({
    methodologyVersion: release.methodologyVersion,
    algorithmVersion: release.compositeAlgorithmVersion,
    sourceIds: ["worldbank_wgi"],
  });
  const wrongCompositeCore = {
    ...composite,
    derivationVersionKey: wrongVersion.key,
    derivationVersions: wrongVersion.envelope,
    contentHash: null,
  };
  const wrongComposite: CiPublishedCompositeRow = {
    ...wrongCompositeCore,
    contentHash: indexContentHash(wrongCompositeCore),
  };
  const vdemRelease: CiReleaseContract = {
    ...release,
    dimensions: [vdemRule, release.dimensions[1]],
    dimensionRowSet: ciDimensionSemanticRowSet([
      vdemDimension,
      dimensions[1],
    ]),
    compositeRowSet: ciCompositeSemanticRowSet([wrongComposite]),
  };

  assert.ok(
    ciPublicationInventoryErrors(
      vdemRelease,
      [vdemDimension, dimensions[1]],
      [wrongComposite],
    ).some((error) => error.includes("selected dimension sources")),
  );
});

test("checked manifest validation binds input bytes, source hashes, and row sets", () => {
  const { release } = fixture();
  const inputBytes = "fixture input manifest\n";
  const inputManifestSha256 =
    "a6543dbfca62bf5185b9bf254e43e2f24b29a90f06906c65e21ac9027196e06a";
  const fixtureRelease = { ...release, inputManifestSha256 };
  const manifest: CiReproductionManifest = {
    schemaVersion: "ci-clean-room-reproduction/v1",
    releaseId: fixtureRelease.releaseId,
    quarter: fixtureRelease.quarter,
    methodologyVersion: fixtureRelease.methodologyVersion,
    vintageLabel: fixtureRelease.vintageLabel,
    inputManifest: "data/releases/fixture/source-input-manifest.v1.json",
    inputSha256: {
      freedom_house: release.dimensions.find(
        (rule) => rule.sourceId === "freedom_house",
      )!.artifactSha256,
      worldbank_wgi: release.dimensions[0].artifactSha256,
    },
    dimensions: fixtureRelease.dimensionRowSet,
    composites: fixtureRelease.compositeRowSet,
  };
  assert.deepEqual(
    ciReproductionManifestErrors(fixtureRelease, manifest, inputBytes),
    [],
  );
  assert.ok(
    ciReproductionManifestErrors(
      fixtureRelease,
      { ...manifest, dimensions: { ...manifest.dimensions, rows: 2 } },
      inputBytes,
    ).includes("reproduction dimension row set mismatch"),
  );
  assert.ok(
    ciReproductionManifestErrors(fixtureRelease, manifest, "changed").includes(
      "checked input manifest byte hash mismatch",
    ),
  );
});
