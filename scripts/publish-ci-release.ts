import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import {
  ciPublicationInventoryErrors,
  ciReproductionManifestErrors,
  ciStagedReleaseHeader,
  type CiPublishedCompositeRow,
  type CiPublishedDimensionRow,
  type CiReproductionManifest,
} from "../src/lib/ci/release-publication";
import {
  ciMethodologyContentSha256,
  ciStoredReleaseHeaderErrors,
  resolveCiRelease,
  type CiStoredReleaseHeader,
} from "../src/lib/ci/release-selection";
import { stableStringify } from "../src/lib/data/frozen-vintage";

type Mode = "stage" | "check" | "publish";

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function selectedMode(): Mode {
  const modes = (["stage", "check", "publish"] as const).filter((mode) =>
    process.argv.includes(`--${mode}`),
  );
  if (modes.length !== 1)
    throw new Error(
      "Choose exactly one mode: --stage, --check, or --publish.",
    );
  return modes[0];
}

function safeCheckedPath(relativePath: string): string {
  const root = process.cwd();
  const releaseRoot = path.resolve(root, "data/releases");
  const absolute = path.resolve(root, relativePath);
  if (
    !absolute.startsWith(`${releaseRoot}${path.sep}`) ||
    path.extname(absolute) !== ".json"
  )
    throw new Error(`Unsafe checked release path: ${relativePath}`);
  return absolute;
}

function numberValue(value: unknown, label: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is not finite`);
  return number;
}

function nullableNumber(value: unknown, label: string): number | null {
  return value == null ? null : numberValue(value, label);
}

function headerFromRow(row: Record<string, unknown>): CiStoredReleaseHeader {
  return {
    id: String(row.id),
    status: String(row.status),
    quarter: String(row.quarter),
    methodologyVersion: String(row.methodologyVersion),
    methodologyContentSha256: String(row.methodologyContentSha256),
    vintageLabel: String(row.vintageLabel),
    supersessionKind:
      String(row.supersessionKind) as CiStoredReleaseHeader["supersessionKind"],
    supersedesReleaseId:
      row.supersedesReleaseId == null ? null : String(row.supersedesReleaseId),
    supersedesVintageLabel:
      row.supersedesVintageLabel == null
        ? null
        : String(row.supersedesVintageLabel),
    inputManifestSha256: String(row.inputManifestSha256),
    dimensionRowSetSha256: String(row.dimensionRowSetSha256),
    compositeRowSetSha256: String(row.compositeRowSetSha256),
    dimensionRowCount: numberValue(
      row.dimensionRowCount,
      "dimension row count",
    ),
    compositeRowCount: numberValue(
      row.compositeRowCount,
      "composite row count",
    ),
    inputTransformationVersion: String(row.inputTransformationVersion),
    compositeAlgorithmVersion: String(row.compositeAlgorithmVersion),
    displayTransformVersion: String(row.displayTransformVersion),
    uncertainty: row.uncertainty as CiStoredReleaseHeader["uncertainty"],
    dimensionRules:
      row.dimensionRules as CiStoredReleaseHeader["dimensionRules"],
    sourceArtifacts: row.sourceArtifacts as Record<string, string>,
  };
}

function stagingHeaderErrors(
  row: CiStoredReleaseHeader,
  expected: CiStoredReleaseHeader,
): string[] {
  const normalized = { ...row, status: "staging" };
  return stableStringify(normalized) === stableStringify(expected)
    ? []
    : ["stored release header differs from the checked release contract"];
}

async function main() {
  const mode = selectedMode();
  const releaseId =
    argument("release-id") ?? process.env.CI_TARGET_RELEASE_ID?.trim();
  if (!releaseId)
    throw new Error(
      "Provide --release-id=<id> or CI_TARGET_RELEASE_ID. No release is inferred for a write.",
    );
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for Index release publication.");

  const release = resolveCiRelease(releaseId);
  const reproductionPath = safeCheckedPath(
    `data/releases/${release.releaseId}/reproduction-manifest.v1.json`,
  );
  const manifest = JSON.parse(
    readFileSync(reproductionPath, "utf8"),
  ) as CiReproductionManifest;
  const inputManifestPath = safeCheckedPath(manifest.inputManifest);
  const inputManifestBytes = readFileSync(inputManifestPath);
  const manifestErrors = ciReproductionManifestErrors(
    release,
    manifest,
    inputManifestBytes,
  );
  if (manifestErrors.length)
    throw new Error(`Checked release artifacts disagree: ${manifestErrors.join("; ")}`);

  const sql = neon(process.env.DATABASE_URL);
  const expectedHeader = ciStagedReleaseHeader(release);
  const [methodology] = await sql`
    SELECT id,weights FROM ci_methodology_versions
    WHERE id=${release.methodologyVersion}`;
  if (!methodology)
    throw new Error(
      `Methodology ${release.methodologyVersion} is not registered.`,
    );
  if (
    ciMethodologyContentSha256({
      id: String(methodology.id),
      weights: methodology.weights,
    }) !== release.methodologyContentSha256
  )
    throw new Error(
      `Methodology ${release.methodologyVersion} content differs from the checked release.`,
    );

  if (mode === "stage") {
    await sql`
      INSERT INTO ci_index_releases (
        id,status,quarter,methodology_version,methodology_content_sha256,vintage_label,
        supersession_kind,supersedes_release_id,supersedes_vintage_label,
        input_manifest_sha256,dimension_row_set_sha256,composite_row_set_sha256,
        dimension_row_count,composite_row_count,input_transformation_version,
        composite_algorithm_version,display_transform_version,uncertainty_policy,
        dimension_rules,source_artifacts
      ) VALUES (
        ${expectedHeader.id},'staging',${expectedHeader.quarter},
        ${expectedHeader.methodologyVersion},${expectedHeader.methodologyContentSha256},
        ${expectedHeader.vintageLabel},${expectedHeader.supersessionKind},
        ${expectedHeader.supersedesReleaseId},
        ${expectedHeader.supersedesVintageLabel},
        ${expectedHeader.inputManifestSha256},${expectedHeader.dimensionRowSetSha256},
        ${expectedHeader.compositeRowSetSha256},${expectedHeader.dimensionRowCount},
        ${expectedHeader.compositeRowCount},${expectedHeader.inputTransformationVersion},
        ${expectedHeader.compositeAlgorithmVersion},${expectedHeader.displayTransformVersion},
        ${JSON.stringify(expectedHeader.uncertainty)}::jsonb,
        ${JSON.stringify(expectedHeader.dimensionRules)}::jsonb,
        ${JSON.stringify(expectedHeader.sourceArtifacts)}::jsonb
      ) ON CONFLICT (id) DO NOTHING`;
  }

  const [storedRow] = await sql`
    SELECT id,status,quarter,methodology_version AS "methodologyVersion",
      methodology_content_sha256 AS "methodologyContentSha256",
      vintage_label AS "vintageLabel",supersession_kind AS "supersessionKind",
      supersedes_release_id AS "supersedesReleaseId",
      supersedes_vintage_label AS "supersedesVintageLabel",
      input_manifest_sha256 AS "inputManifestSha256",
      dimension_row_set_sha256 AS "dimensionRowSetSha256",
      composite_row_set_sha256 AS "compositeRowSetSha256",
      dimension_row_count AS "dimensionRowCount",composite_row_count AS "compositeRowCount",
      input_transformation_version AS "inputTransformationVersion",
      composite_algorithm_version AS "compositeAlgorithmVersion",
      display_transform_version AS "displayTransformVersion",
      uncertainty_policy AS uncertainty,dimension_rules AS "dimensionRules",
      source_artifacts AS "sourceArtifacts"
    FROM ci_index_releases WHERE id=${release.releaseId}`;
  if (!storedRow)
    throw new Error(
      `Release ${release.releaseId} is not staged; run this command with --stage first.`,
    );
  const storedHeader = headerFromRow(storedRow);
  const headerErrors =
    storedHeader.status === "published"
      ? ciStoredReleaseHeaderErrors(storedHeader, release)
      : stagingHeaderErrors(storedHeader, expectedHeader);
  if (headerErrors.length)
    throw new Error(`Stored release header disagrees: ${headerErrors.join("; ")}`);

  if (mode === "stage") {
    if (storedHeader.status !== "staging")
      throw new Error(`${release.releaseId} is already published and immutable.`);
    console.log(
      `PASS — staged immutable header ${release.releaseId}; run the pinned ingestion/calculation before --check and --publish.`,
    );
    return;
  }

  const rawDimensions = await sql`
    SELECT d.release_id AS "releaseId",d.jurisdiction_id::text AS "jurisdictionId",
      j.iso3,d.dimension,d.source_id AS "sourceId",d.indicator_id AS "indicatorId",
      d.raw_value AS "rawValue",d.normalized_score AS "normalizedScore",d.quarter,
      d.methodology_version AS "methodologyVersion",d.transformation_id AS "transformationId",
      d.method_version AS "methodVersion",d.artifact_hash AS "artifactHash",
      d.upstream_release AS "upstreamRelease",d.artifact_kind AS "artifactKind",
      d.temporal_coverage AS "temporalCoverage",d.license_url AS "licenseUrl",
      d.substitution_reason AS "substitutionReason",
      d.derivation_version_key AS "derivationVersionKey",d.derivation_versions AS "derivationVersions"
    FROM ci_dimension_scores d JOIN jurisdictions j ON j.id=d.jurisdiction_id
    WHERE d.release_id=${release.releaseId}`;
  const dimensions: CiPublishedDimensionRow[] = rawDimensions.map((row) => ({
    ...row,
    releaseId: String(row.releaseId),
    jurisdictionId: String(row.jurisdictionId),
    iso3: String(row.iso3),
    dimension: String(row.dimension),
    sourceId: String(row.sourceId),
    indicatorId: String(row.indicatorId),
    rawValue: nullableNumber(row.rawValue, "dimension raw value"),
    normalizedScore: numberValue(
      row.normalizedScore,
      "dimension normalized score",
    ),
    quarter: String(row.quarter),
    methodologyVersion: String(row.methodologyVersion),
    transformationId: String(row.transformationId),
    methodVersion: String(row.methodVersion),
    artifactHash: String(row.artifactHash),
    upstreamRelease: String(row.upstreamRelease),
    artifactKind: String(row.artifactKind),
    temporalCoverage: String(row.temporalCoverage),
    licenseUrl: String(row.licenseUrl),
    substitutionReason:
      row.substitutionReason == null ? null : String(row.substitutionReason),
    derivationVersionKey: String(row.derivationVersionKey),
    derivationVersions: row.derivationVersions as CiPublishedDimensionRow["derivationVersions"],
  }));

  const rawComposites = await sql`
    SELECT c.release_id AS "releaseId",c.jurisdiction_id::text AS "jurisdictionId",
      j.iso3,c.quarter,c.score,c.score_lower AS "scoreLower",c.score_upper AS "scoreUpper",
      c.completeness_flag AS "completenessFlag",c.vintage_label AS "vintageLabel",
      c.supersedes_vintage_label AS "supersedesVintageLabel",
      c.rank,c.total_ranked AS "totalRanked",c.is_partial AS "isPartial",
      c.dimensions_available AS "dimensionsAvailable",c.missing_dimensions AS "missingDimensions",
      c.methodology_version AS "methodologyVersion",c.content_hash AS "contentHash",
      c.derivation_version_key AS "derivationVersionKey",c.derivation_versions AS "derivationVersions"
    FROM ci_composite_scores c JOIN jurisdictions j ON j.id=c.jurisdiction_id
    WHERE c.release_id=${release.releaseId}`;
  const composites: CiPublishedCompositeRow[] = rawComposites.map((row) => ({
    releaseId: String(row.releaseId),
    jurisdictionId: String(row.jurisdictionId),
    iso3: String(row.iso3),
    quarter: String(row.quarter),
    score: numberValue(row.score, "composite score"),
    scoreLower: nullableNumber(row.scoreLower, "composite lower bound"),
    scoreUpper: nullableNumber(row.scoreUpper, "composite upper bound"),
    completenessFlag:
      row.completenessFlag == null ? null : String(row.completenessFlag),
    vintageLabel: row.vintageLabel == null ? null : String(row.vintageLabel),
    supersedesVintageLabel:
      row.supersedesVintageLabel == null
        ? null
        : String(row.supersedesVintageLabel),
    rank: row.rank == null ? null : numberValue(row.rank, "composite rank"),
    totalRanked:
      row.totalRanked == null
        ? null
        : numberValue(row.totalRanked, "composite total ranked"),
    isPartial: row.isPartial === true,
    dimensionsAvailable: numberValue(
      row.dimensionsAvailable,
      "composite dimensions available",
    ),
    missingDimensions: Array.isArray(row.missingDimensions)
      ? row.missingDimensions.map(String)
      : null,
    methodologyVersion: String(row.methodologyVersion),
    contentHash: row.contentHash == null ? null : String(row.contentHash),
    derivationVersionKey: String(row.derivationVersionKey),
    derivationVersions: row.derivationVersions as CiPublishedCompositeRow["derivationVersions"],
  }));

  const inventoryErrors = ciPublicationInventoryErrors(
    release,
    dimensions,
    composites,
  );
  if (inventoryErrors.length)
    throw new Error(
      `Release rows do not reproduce the checked release: ${inventoryErrors.join("; ")}`,
    );

  const [storage] = await sql`
    SELECT civica_ci_dimension_storage_sha256(${release.releaseId}) AS "dimensionSha256",
      civica_ci_composite_storage_sha256(${release.releaseId}) AS "compositeSha256"`;
  const dimensionStorageSha256 = String(storage?.dimensionSha256 ?? "");
  const compositeStorageSha256 = String(storage?.compositeSha256 ?? "");
  if (
    !/^[a-f0-9]{64}$/.test(dimensionStorageSha256) ||
    !/^[a-f0-9]{64}$/.test(compositeStorageSha256)
  )
    throw new Error("Database storage fingerprints are unavailable or invalid.");

  if (mode === "check") {
    console.log(
      `PASS — ${release.releaseId} reproduces ${dimensions.length} dimension rows and ${composites.length} composite rows; pointer unchanged.`,
    );
    return;
  }

  if (storedHeader.status === "staging") {
    await sql`SELECT civica_publish_ci_release(
      ${release.releaseId},${release.inputManifestSha256},
      ${release.dimensionRowSet.sha256},${release.compositeRowSet.sha256},
      ${dimensionStorageSha256},${compositeStorageSha256}
    )`;
  }
  const [published] = await sql`
    SELECT r.status,p.release_id AS "pointerReleaseId"
    FROM ci_index_releases r
    LEFT JOIN ci_index_release_pointers p ON p.product='civica_index'
    WHERE r.id=${release.releaseId}`;
  if (
    published?.status !== "published" ||
    published?.pointerReleaseId !== release.releaseId
  )
    throw new Error("Atomic publication did not leave the expected public pointer.");
  console.log(
    `PASS — atomically published ${release.releaseId}; ${dimensions.length} dimension rows and ${composites.length} composite rows are immutable.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
