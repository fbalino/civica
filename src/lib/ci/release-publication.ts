import { createHash } from "node:crypto";

import { stableStringify } from "../data/frozen-vintage";
import type { DerivationVersionEnvelope } from "../research/derivation-version";
import {
  ciReleaseCompositeRowErrors,
  ciReleaseDimensionRowErrors,
  publicCiReleaseIdentity,
  selectCiReleaseDimensionRows,
  type CiReleaseCompositeRow,
  type CiReleaseContract,
  type CiReleaseDimensionRow,
  type CiStoredReleaseHeader,
} from "./release-selection";
import { ciVersionEnvelope } from "./versioning";

export const CI_REPRODUCTION_MANIFEST_SCHEMA_VERSION =
  "ci-clean-room-reproduction/v1" as const;

export interface CiReproductionManifest {
  schemaVersion: string;
  releaseId: string;
  quarter: string;
  methodologyVersion: string;
  vintageLabel: string;
  inputManifest: string;
  inputSha256: Record<string, string>;
  dimensions: { rows: number; sha256: string };
  composites: { rows: number; sha256: string };
}

export interface CiPublishedDimensionRow extends CiReleaseDimensionRow {
  iso3: string;
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
}

export interface CiPublishedCompositeRow extends CiReleaseCompositeRow {
  iso3: string;
}

export interface CiSemanticRowSet {
  rows: number;
  sha256: string;
}

const SHA256 = /^[a-f0-9]{64}$/;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashRows(rows: readonly unknown[]): string {
  return sha256(stableStringify(rows));
}

export function ciReleaseSourceArtifacts(
  release: CiReleaseContract,
): Record<string, string> {
  return Object.fromEntries(
    [...release.dimensions]
      .sort((left, right) =>
        `${left.sourceId}:${left.indicatorId}`.localeCompare(
          `${right.sourceId}:${right.indicatorId}`,
        ),
      )
      .map((row) => [
        `${row.sourceId}:${row.indicatorId}`,
        row.artifactSha256,
      ]),
  );
}

/** The complete immutable header must exist before any release-bound row. */
export function ciStagedReleaseHeader(
  release: CiReleaseContract,
): CiStoredReleaseHeader {
  return {
    id: release.releaseId,
    status: "staging",
    quarter: release.quarter,
    methodologyVersion: release.methodologyVersion,
    methodologyContentSha256: release.methodologyContentSha256,
    vintageLabel: release.vintageLabel,
    supersessionKind: release.supersessionKind,
    supersedesReleaseId: release.supersedesReleaseId,
    supersedesVintageLabel: release.supersedesVintageLabel,
    inputManifestSha256: release.inputManifestSha256,
    dimensionRowSetSha256: release.dimensionRowSet.sha256,
    compositeRowSetSha256: release.compositeRowSet.sha256,
    dimensionRowCount: release.dimensionRowSet.rows,
    compositeRowCount: release.compositeRowSet.rows,
    inputTransformationVersion: release.inputTransformationVersion,
    compositeAlgorithmVersion: release.compositeAlgorithmVersion,
    displayTransformVersion: release.displayTransformVersion,
    uncertainty: release.uncertainty,
    dimensionRules: [...release.dimensions].sort((left, right) =>
      `${left.dimension}:${left.priority}:${left.sourceId}:${left.indicatorId}`.localeCompare(
        `${right.dimension}:${right.priority}:${right.sourceId}:${right.indicatorId}`,
      ),
    ),
    sourceArtifacts: ciReleaseSourceArtifacts(release),
  };
}

export function ciReproductionManifestErrors(
  release: CiReleaseContract,
  manifest: CiReproductionManifest,
  inputManifestBytes: string | Uint8Array,
): string[] {
  const errors: string[] = [];
  const identity = publicCiReleaseIdentity(release);
  if (manifest.schemaVersion !== CI_REPRODUCTION_MANIFEST_SCHEMA_VERSION)
    errors.push("reproduction manifest schema mismatch");
  if (manifest.releaseId !== identity.releaseId)
    errors.push("reproduction release id mismatch");
  if (manifest.quarter !== identity.quarter)
    errors.push("reproduction quarter mismatch");
  if (manifest.methodologyVersion !== identity.methodologyVersion)
    errors.push("reproduction methodology mismatch");
  if (manifest.vintageLabel !== identity.vintageLabel)
    errors.push("reproduction vintage label mismatch");
  if (!manifest.inputManifest?.startsWith("data/releases/"))
    errors.push("reproduction input manifest path is not a checked release path");
  if (sha256(inputManifestBytes) !== identity.inputManifestSha256)
    errors.push("checked input manifest byte hash mismatch");
  if (
    manifest.dimensions?.rows !== identity.dimensionRowSet.rows ||
    manifest.dimensions?.sha256 !== identity.dimensionRowSet.sha256
  )
    errors.push("reproduction dimension row set mismatch");
  if (
    manifest.composites?.rows !== identity.compositeRowSet.rows ||
    manifest.composites?.sha256 !== identity.compositeRowSet.sha256
  )
    errors.push("reproduction composite row set mismatch");

  const expectedInputs = Object.fromEntries(
    [...new Set(release.dimensions.map((row) => row.sourceId))]
      .sort()
      .map((sourceId) => [
        sourceId,
        release.dimensions.find((row) => row.sourceId === sourceId)!
          .artifactSha256,
      ]),
  );
  if (
    stableStringify(manifest.inputSha256) !== stableStringify(expectedInputs)
  )
    errors.push("reproduction source input hashes mismatch");
  for (const [sourceId, hash] of Object.entries(
    manifest.inputSha256 ?? {},
  )) {
    if (!sourceId.trim() || !SHA256.test(hash))
      errors.push(`reproduction source input is invalid: ${sourceId}`);
  }
  return errors;
}

export function ciDimensionSemanticRows(
  rows: readonly CiPublishedDimensionRow[],
) {
  return [...rows]
    .map((row) => ({
      jurisdictionId: row.jurisdictionId,
      iso3: row.iso3,
      dimension: row.dimension,
      indicatorId: row.indicatorId,
      sourceId: row.sourceId,
      rawValue: row.rawValue,
      normalizedScore: row.normalizedScore,
      quarter: row.quarter,
      methodologyVersion: row.methodologyVersion,
    }))
    .sort((left, right) =>
      `${left.iso3}:${left.dimension}:${left.sourceId}:${left.indicatorId}`.localeCompare(
        `${right.iso3}:${right.dimension}:${right.sourceId}:${right.indicatorId}`,
      ),
    );
}

export function ciCompositeSemanticRows(
  rows: readonly CiPublishedCompositeRow[],
) {
  return [...rows]
    .map((row) => ({
      jurisdictionId: row.jurisdictionId,
      iso3: row.iso3,
      score: row.score,
      scoreLower: row.scoreLower,
      scoreUpper: row.scoreUpper,
      completenessFlag: row.completenessFlag,
      rank: row.rank,
      totalRanked: row.totalRanked,
      isPartial: row.isPartial,
      dimensionsAvailable: row.dimensionsAvailable,
      missingDimensions: [...(row.missingDimensions ?? [])],
      quarter: row.quarter,
      methodologyVersion: row.methodologyVersion,
      vintageLabel: row.vintageLabel,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.jurisdictionId.localeCompare(right.jurisdictionId),
    );
}

export function ciDimensionSemanticRowSet(
  rows: readonly CiPublishedDimensionRow[],
): CiSemanticRowSet {
  const semanticRows = ciDimensionSemanticRows(rows);
  return { rows: semanticRows.length, sha256: hashRows(semanticRows) };
}

export function ciCompositeSemanticRowSet(
  rows: readonly CiPublishedCompositeRow[],
): CiSemanticRowSet {
  const semanticRows = ciCompositeSemanticRows(rows);
  return { rows: semanticRows.length, sha256: hashRows(semanticRows) };
}

/**
 * Final credential-free seam for negative fixtures and the live publication
 * CLI. A row set is publishable only if every row agrees with one release and
 * the exact clean-room count/hash pair is reproduced.
 */
export function ciPublicationInventoryErrors(
  release: CiReleaseContract,
  dimensions: readonly CiPublishedDimensionRow[],
  composites: readonly CiPublishedCompositeRow[],
): string[] {
  const errors: string[] = [];
  const dimensionIdentities = new Set<string>();
  for (const row of dimensions) {
    const identity = `${row.jurisdictionId}:${row.dimension}:${row.sourceId}:${row.indicatorId}`;
    if (dimensionIdentities.has(identity))
      errors.push(`duplicate dimension identity: ${identity}`);
    dimensionIdentities.add(identity);
    for (const error of ciReleaseDimensionRowErrors(row, release))
      errors.push(`${identity}: ${error}`);
    if (!/^[A-Z]{3}$/.test(row.iso3))
      errors.push(`${identity}: invalid ISO3`);
    if (
      !Number.isFinite(row.normalizedScore) ||
      (row.rawValue !== null && !Number.isFinite(row.rawValue))
    )
      errors.push(`${identity}: non-finite dimension value`);
    const expectedVersion = ciVersionEnvelope({
      methodologyVersion: release.methodologyVersion,
      algorithmVersion: release.inputTransformationVersion,
      sourceIds: [row.sourceId],
    });
    if (
      stableStringify(row.derivationVersions) !==
      stableStringify(expectedVersion.envelope)
    )
      errors.push(`${identity}: derivation envelope mismatch`);
    if (row.derivationVersionKey !== expectedVersion.key)
      errors.push(`${identity}: derivation key mismatch`);
  }

  let selectedDimensions: readonly CiPublishedDimensionRow[] = [];
  try {
    selectedDimensions = selectCiReleaseDimensionRows(
      dimensions,
      release.releaseId,
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `dimension selection failed: ${error.message}`
        : "dimension selection failed",
    );
  }
  const selectedSourcesByJurisdiction = new Map<string, Set<string>>();
  for (const row of selectedDimensions) {
    const sources =
      selectedSourcesByJurisdiction.get(row.jurisdictionId) ?? new Set<string>();
    sources.add(row.sourceId);
    selectedSourcesByJurisdiction.set(row.jurisdictionId, sources);
  }

  const compositeIdentities = new Set<string>();
  for (const row of composites) {
    if (compositeIdentities.has(row.jurisdictionId))
      errors.push(`duplicate composite identity: ${row.jurisdictionId}`);
    compositeIdentities.add(row.jurisdictionId);
    for (const error of ciReleaseCompositeRowErrors(row, release))
      errors.push(`${row.jurisdictionId}: ${error}`);
    if (!/^[A-Z]{3}$/.test(row.iso3))
      errors.push(`${row.jurisdictionId}: invalid ISO3`);
    if (!Number.isFinite(row.score))
      errors.push(`${row.jurisdictionId}: non-finite composite score`);
    if (row.totalRanked !== composites.length)
      errors.push(`${row.jurisdictionId}: total-ranked mismatch`);
    const expectedSources = [
      ...(selectedSourcesByJurisdiction.get(row.jurisdictionId) ?? []),
    ].sort();
    if (!expectedSources.length) {
      errors.push(`${row.jurisdictionId}: no selected dimension sources`);
    } else {
      const expectedVersion = ciVersionEnvelope({
        methodologyVersion: release.methodologyVersion,
        algorithmVersion: release.compositeAlgorithmVersion,
        sourceIds: expectedSources,
      });
      if (
        stableStringify(row.derivationVersions) !==
        stableStringify(expectedVersion.envelope)
      )
        errors.push(
          `${row.jurisdictionId}: composite derivation does not match selected dimension sources`,
        );
      if (row.derivationVersionKey !== expectedVersion.key)
        errors.push(`${row.jurisdictionId}: composite derivation key mismatch`);
    }
  }

  const dimensionSet = ciDimensionSemanticRowSet(dimensions);
  const compositeSet = ciCompositeSemanticRowSet(composites);
  if (
    dimensionSet.rows !== release.dimensionRowSet.rows ||
    dimensionSet.sha256 !== release.dimensionRowSet.sha256
  )
    errors.push("dimension semantic row-set mismatch");
  if (
    compositeSet.rows !== release.compositeRowSet.rows ||
    compositeSet.sha256 !== release.compositeRowSet.sha256
  )
    errors.push("composite semantic row-set mismatch");
  return errors;
}
