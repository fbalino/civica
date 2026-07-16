import {
  CI_INGEST_ALGORITHM_VERSION,
  CI_BETA_COMPOSITE_ALGORITHM_VERSION,
  ciVersionEnvelope,
} from "./versioning";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_QUARTER,
  CURRENT_CI_RELEASE_ID,
  CURRENT_CI_VINTAGE_LABEL,
} from "./current-release";
import { normalizeV2 } from "./normalize-v2";
import {
  frozenContentHash,
  indexContentHash,
  stableStringify,
} from "../data/frozen-vintage";
import {
  derivationVersionErrors,
  sourceBasketVersion,
  type DerivationVersionEnvelope,
} from "../research/derivation-version";
import { assertCiSeriesProvenance, ciSeriesProvenanceErrors, type CiSeriesProvenance } from "./series-provenance";
import { V2_WEIGHTS } from "./dimensions-v2";

export type CiReleaseDimensionRule = {
  dimension: string;
  sourceId: string;
  indicatorId: string;
  priority: number;
  artifactSha256: string;
  upstreamRelease: string;
  artifactKind: "publisher_bytes";
  temporalCoverage: string;
  licenseUrl: string;
  substitutionReason: string | null;
};

export type CiReleaseContract = {
  releaseId: string;
  methodologyVersion: string;
  quarter: string;
  vintageLabel: string;
  supersessionKind: "none" | "registered_release" | "legacy_unregistered_vintage";
  supersedesReleaseId: string | null;
  supersedesVintageLabel: string | null;
  methodologyContentSha256: string;
  inputTransformationVersion: string;
  compositeAlgorithmVersion: string;
  displayTransformVersion: string;
  inputManifestSha256: string;
  dimensionRowSet: { rows: number; sha256: string };
  compositeRowSet: { rows: number; sha256: string };
  uncertainty: {
    schemaVersion: "ci-index-uncertainty/v1";
    pointEstimate: "seeded_simulation_median" | "deterministic_weighted_composite";
    displayedRange: "sensitivity_summary_5th_95th_percentile" | "not_published";
    bounds: "required" | "absent";
    simulations: number;
    covarianceModel: "independence_assumed" | "not_available";
    interpretation: string;
  };
  series: CiSeriesProvenance;
  dimensions: readonly CiReleaseDimensionRule[];
};

export const CI_RELEASE_IDENTITY_SCHEMA_VERSION =
  "ci-release-identity/v1" as const;

export class CiReleaseConsistencyError extends Error {
  readonly code = "RELEASE_INCONSISTENT" as const;

  constructor(message: string) {
    super(message);
    this.name = "CiReleaseConsistencyError";
  }
}

export function isCiReleaseConsistencyError(
  value: unknown,
): value is CiReleaseConsistencyError {
  return value instanceof CiReleaseConsistencyError;
}

const INPUT_HASHES = {
  vdem: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
  worldbank_wgi: "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8",
  freedom_house: "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88",
  transparency_intl: "34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736",
} as const;

function dimensionRule(
  dimension: string,
  sourceId: keyof typeof INPUT_HASHES,
  indicatorId: string,
  priority: number,
  licenseUrl: string,
  substitutionReason: string | null = null,
): CiReleaseDimensionRule {
  return Object.freeze({
    dimension,
    sourceId,
    indicatorId,
    priority,
    artifactSha256: INPUT_HASHES[sourceId],
    upstreamRelease: `${sourceId} 2024 release`,
    artifactKind: "publisher_bytes" as const,
    temporalCoverage: "2024",
    licenseUrl,
    substitutionReason,
  });
}

const DIMENSION_RULES: readonly CiReleaseDimensionRule[] = [
  dimensionRule(
    "democratic_quality",
    "vdem",
    "v2x_libdem",
    1,
    "https://www.v-dem.net/media/datasets/V-Dem-CY-Core-v15_csv.zip",
  ),
  dimensionRule(
    "democratic_quality",
    "worldbank_wgi",
    "va.est",
    2,
    "https://datacatalog.worldbank.org/public-licenses",
    "Coverage substitution where the primary V-Dem indicator has no jurisdiction row.",
  ),
  dimensionRule(
    "rule_of_law",
    "worldbank_wgi",
    "rl.est",
    1,
    "https://datacatalog.worldbank.org/public-licenses",
  ),
  dimensionRule(
    "freedom_rights",
    "freedom_house",
    "fh_pr_cl_sum",
    1,
    "https://freedomhouse.org/sites/default/files/2024-02/Aggregate_Category_and_Subcategory_Scores_FIW_2003-2024.xlsx",
  ),
  dimensionRule(
    "corruption_control",
    "transparency_intl",
    "CPI_SCORE",
    1,
    "https://images.transparencycdn.org/images/CPI2024-Results-and-trends.xlsx",
  ),
] as const;

function betaRelease(
  releaseId: string,
  methodologyVersion: string,
  vintageLabel: string,
  compositeAlgorithmVersion: string,
  calculatedAt: string,
  dimensionRowSetSha256: string,
  compositeRowSetSha256: string,
  options: {
    methodologyContentSha256: string;
    supersessionKind: CiReleaseContract["supersessionKind"];
    supersedesReleaseId: string | null;
    supersedesVintageLabel: string | null;
    uncertainty: CiReleaseContract["uncertainty"];
  },
): CiReleaseContract {
  return Object.freeze({
    releaseId,
    methodologyVersion,
    quarter: "2024-Q4",
    vintageLabel,
    supersessionKind: options.supersessionKind,
    supersedesReleaseId: options.supersedesReleaseId,
    supersedesVintageLabel: options.supersedesVintageLabel,
    methodologyContentSha256: options.methodologyContentSha256,
    inputTransformationVersion: CI_INGEST_ALGORITHM_VERSION,
    compositeAlgorithmVersion,
    displayTransformVersion: "ci-display/fixed-native-bounds-v1",
    inputManifestSha256:
      "dc74a651c96ec770cd8128cb22c61d663f0b8192f9441ce55ff44f24966602cc",
    dimensionRowSet: Object.freeze({
      rows: 745,
      sha256: dimensionRowSetSha256,
    }),
    compositeRowSet: Object.freeze({
      rows: 190,
      sha256: compositeRowSetSha256,
    }),
    uncertainty: Object.freeze(options.uncertainty),
    series: assertCiSeriesProvenance({
      releaseId,
      seriesType: "harmonized_backcast",
      observationPeriodStart: "2024-Q4",
      observationPeriodEnd: "2024-Q4",
      originalPublicationCutAt: null,
      calculatedAt,
      methodVersion: compositeAlgorithmVersion,
      citationLabel: `${vintageLabel} — 2024-Q4 reference inputs; harmonized backcast calculated 2026; method ${compositeAlgorithmVersion}`,
    }),
    dimensions: DIMENSION_RULES,
  });
}

export const CI_RELEASE_CONTRACTS = Object.freeze([
  betaRelease(
    "ci-beta-r3-2024-Q4",
    "beta-r3",
    "Civica Index 2024 Q4 (Beta-R3)",
    "ci-composite/fixed-bounds-monte-carlo-v2",
    "2026-07-11T10:49:21.451Z",
    "d16100ada72a2037a5c311b098eb8bb283ef0d01f1a346efdf74126b1fb65327",
    "dfc3b2d53587fa3901a368b32580f648ee54d68ecbaaae7163515972083b2fa3",
    {
      methodologyContentSha256:
        "bda3f38947afc44b1a1d54ffe22ad4540068abeb4c29ca907b50a174e5536e85",
      supersessionKind: "legacy_unregistered_vintage",
      supersedesReleaseId: null,
      supersedesVintageLabel: "Civica Index 2024 Q4 (Beta-R2)",
      uncertainty: {
        schemaVersion: "ci-index-uncertainty/v1",
        pointEstimate: "seeded_simulation_median",
        displayedRange: "sensitivity_summary_5th_95th_percentile",
        bounds: "required",
        simulations: 10_000,
        covarianceModel: "independence_assumed",
        interpretation:
          "Sensitivity summary under declared perturbation and independence assumptions; not a calibrated confidence interval.",
      },
    },
  ),
  betaRelease(
    "ci-beta-r4-2024-Q4",
    "beta-r4",
    "Civica Index 2024 Q4 (Beta-R4)",
    "ci-composite/fixed-bounds-weighted-v3",
    "2026-07-11T11:26:26.793Z",
    "65ffdc77324b12f60467837549b849fde9f01a9df9ae1105acbe0a0aaf63d991",
    "24b282f57a4c04bd152abbce2967f5474847f6f4c1e3cc03ca926d9783d0a605",
    {
      methodologyContentSha256:
        "55344e56d2db234b0e7ccbd809ea43297ded26ad42520e5211cc8bbb2cb69bcc",
      supersessionKind: "registered_release",
      supersedesReleaseId: "ci-beta-r3-2024-Q4",
      supersedesVintageLabel: "Civica Index 2024 Q4 (Beta-R3)",
      uncertainty: {
        schemaVersion: "ci-index-uncertainty/v1",
        pointEstimate: "deterministic_weighted_composite",
        displayedRange: "not_published",
        bounds: "absent",
        simulations: 0,
        covarianceModel: "not_available",
        interpretation:
          "No range is published because source-specific uncertainty and dependence were not retained and validated for this release.",
      },
    },
  ),
  betaRelease(
    CURRENT_CI_RELEASE_ID,
    CURRENT_CI_METHODOLOGY_VERSION,
    CURRENT_CI_VINTAGE_LABEL,
    CI_BETA_COMPOSITE_ALGORITHM_VERSION,
    "2026-07-11T11:38:23.634Z",
    "6dd1ebe3b7b5e29d190bdc52595e06d5776068b5cbbfa7adbb0b04239f72923d",
    "109f70af2629f9af6b5af29d89f94280f302a1fa0d1d1461e136e47238c31e35",
    {
      methodologyContentSha256:
        "39eebd5d0c3f46e900e7bc4e09cac778ac10ad2cef1c4b9b79261a2654a58b8a",
      supersessionKind: "registered_release",
      supersedesReleaseId: "ci-beta-r4-2024-Q4",
      supersedesVintageLabel: "Civica Index 2024 Q4 (Beta-R4)",
      uncertainty: {
        schemaVersion: "ci-index-uncertainty/v1",
        pointEstimate: "deterministic_weighted_composite",
        displayedRange: "not_published",
        bounds: "absent",
        simulations: 0,
        covarianceModel: "not_available",
        interpretation:
          "No range is published because source-specific uncertainty and dependence were not retained and validated for this release.",
      },
    },
  ),
] as const);

export function resolveCiRelease(releaseId: string = CURRENT_CI_RELEASE_ID): CiReleaseContract {
  const release = CI_RELEASE_CONTRACTS.find((row) => row.releaseId === releaseId);
  if (!release) throw new Error(`Unknown Civica Index release: ${releaseId}`);
  return release;
}

export function publicCiReleaseIdentity(
  releaseOrId: CiReleaseContract | string = CURRENT_CI_RELEASE_ID,
) {
  const release =
    typeof releaseOrId === "string"
      ? resolveCiRelease(releaseOrId)
      : releaseOrId;
  return Object.freeze({
    schemaVersion: CI_RELEASE_IDENTITY_SCHEMA_VERSION,
    releaseId: release.releaseId,
    methodologyVersion: release.methodologyVersion,
    quarter: release.quarter,
    vintageLabel: release.vintageLabel,
    supersessionKind: release.supersessionKind,
    supersedesReleaseId: release.supersedesReleaseId,
    supersedesVintageLabel: release.supersedesVintageLabel,
    methodologyContentSha256: release.methodologyContentSha256,
    inputTransformationVersion: release.inputTransformationVersion,
    compositeAlgorithmVersion: release.compositeAlgorithmVersion,
    displayTransformVersion: release.displayTransformVersion,
    inputManifestSha256: release.inputManifestSha256,
    dimensionRowSet: release.dimensionRowSet,
    compositeRowSet: release.compositeRowSet,
    uncertainty: release.uncertainty,
    dimensionRules: Object.freeze(
      [...release.dimensions]
        .sort((left, right) =>
          `${left.dimension}:${left.priority}:${left.sourceId}:${left.indicatorId}`.localeCompare(
            `${right.dimension}:${right.priority}:${right.sourceId}:${right.indicatorId}`,
          ),
        )
        .map((rule) => Object.freeze({ ...rule })),
    ),
    sourceArtifacts: Object.freeze(
      Object.fromEntries(
        [...release.dimensions]
          .sort((a, b) =>
            `${a.sourceId}:${a.indicatorId}`.localeCompare(
              `${b.sourceId}:${b.indicatorId}`,
            ),
          )
          .map((row) => [
            `${row.sourceId}:${row.indicatorId}`,
            row.artifactSha256,
          ]),
      ),
    ),
  });
}

export function ciMethodologyContentSha256(input: {
  id: string;
  weights: unknown;
}): string {
  return frozenContentHash({ id: input.id, weights: input.weights });
}

export function assertCiReleaseMethodologyRecord<
  T extends { id: string; weights: unknown },
>(row: T, releaseId: string = CURRENT_CI_RELEASE_ID): T {
  const release = resolveCiRelease(releaseId);
  const hash = ciMethodologyContentSha256(row);
  if (
    row.id !== release.methodologyVersion ||
    hash !== release.methodologyContentSha256
  ) {
    throw new CiReleaseConsistencyError(
      `${release.releaseId}: methodology content differs from the frozen release`,
    );
  }
  return row;
}

export interface CiStoredReleaseHeader {
  id: string;
  status: string;
  quarter: string;
  methodologyVersion: string;
  vintageLabel: string;
  supersessionKind: string;
  supersedesReleaseId: string | null;
  supersedesVintageLabel: string | null;
  methodologyContentSha256: string;
  inputManifestSha256: string;
  dimensionRowSetSha256: string;
  compositeRowSetSha256: string;
  dimensionRowCount: number;
  compositeRowCount: number;
  inputTransformationVersion: string;
  compositeAlgorithmVersion: string;
  displayTransformVersion: string;
  sourceArtifacts: Record<string, string>;
  dimensionRules: readonly CiReleaseDimensionRule[];
  uncertainty: CiReleaseContract["uncertainty"];
}

export function ciStoredReleaseHeaderErrors(
  row: CiStoredReleaseHeader,
  release: CiReleaseContract = resolveCiRelease(row.id),
): string[] {
  const identity = publicCiReleaseIdentity(release);
  const errors: string[] = [];
  if (row.id !== identity.releaseId) errors.push("release id mismatch");
  if (row.status !== "published") errors.push("release is not published");
  if (row.quarter !== identity.quarter) errors.push("quarter mismatch");
  if (row.methodologyVersion !== identity.methodologyVersion)
    errors.push("methodology version mismatch");
  if (row.vintageLabel !== identity.vintageLabel)
    errors.push("vintage label mismatch");
  if (row.supersessionKind !== identity.supersessionKind)
    errors.push("supersession kind mismatch");
  if (row.supersedesReleaseId !== identity.supersedesReleaseId)
    errors.push("superseded release id mismatch");
  if (row.supersedesVintageLabel !== identity.supersedesVintageLabel)
    errors.push("superseded vintage label mismatch");
  if (row.methodologyContentSha256 !== identity.methodologyContentSha256)
    errors.push("methodology content hash mismatch");
  if (row.inputManifestSha256 !== identity.inputManifestSha256)
    errors.push("input manifest hash mismatch");
  if (row.dimensionRowSetSha256 !== identity.dimensionRowSet.sha256)
    errors.push("dimension row-set hash mismatch");
  if (row.compositeRowSetSha256 !== identity.compositeRowSet.sha256)
    errors.push("composite row-set hash mismatch");
  if (row.dimensionRowCount !== identity.dimensionRowSet.rows)
    errors.push("dimension row count mismatch");
  if (row.compositeRowCount !== identity.compositeRowSet.rows)
    errors.push("composite row count mismatch");
  if (row.inputTransformationVersion !== identity.inputTransformationVersion)
    errors.push("input transformation mismatch");
  if (row.compositeAlgorithmVersion !== identity.compositeAlgorithmVersion)
    errors.push("composite algorithm mismatch");
  if (row.displayTransformVersion !== identity.displayTransformVersion)
    errors.push("display transform mismatch");
  if (stableStringify(row.uncertainty) !== stableStringify(identity.uncertainty))
    errors.push("uncertainty policy mismatch");
  if (
    JSON.stringify(Object.entries(row.sourceArtifacts).sort()) !==
    JSON.stringify(Object.entries(identity.sourceArtifacts).sort())
  ) {
    errors.push("source artifact basket mismatch");
  }
  if (stableStringify(row.dimensionRules) !== stableStringify(identity.dimensionRules))
    errors.push("dimension release rules mismatch");
  return errors;
}

export interface CiReleaseCompositeRow {
  releaseId: string | null;
  jurisdictionId: string;
  quarter: string;
  score: number;
  scoreLower: number | null;
  scoreUpper: number | null;
  completenessFlag: string | null;
  vintageLabel: string | null;
  supersedesVintageLabel: string | null;
  rank: number | null;
  totalRanked: number | null;
  isPartial: boolean;
  dimensionsAvailable: number;
  missingDimensions: readonly string[] | null;
  methodologyVersion: string;
  contentHash: string | null;
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
}

export function ciReleaseCompositeRowErrors(
  row: CiReleaseCompositeRow,
  release: CiReleaseContract = resolveCiRelease(row.releaseId ?? ""),
): string[] {
  const errors = derivationVersionErrors(row.derivationVersions, {
    allowLegacy: false,
  });
  if (row.releaseId !== release.releaseId) errors.push("release id mismatch");
  if (row.methodologyVersion !== release.methodologyVersion)
    errors.push("methodology version mismatch");
  if (row.quarter !== release.quarter) errors.push("release quarter mismatch");
  if (row.totalRanked !== release.compositeRowSet.rows)
    errors.push("ranked population differs from release row count");
  if (row.rank == null || row.rank < 1 || row.rank > release.compositeRowSet.rows)
    errors.push("release rank is outside the published population");
  if (row.vintageLabel !== release.vintageLabel)
    errors.push("vintage label mismatch");
  if (row.supersedesVintageLabel !== release.supersedesVintageLabel)
    errors.push("superseded vintage label mismatch");
  if (
    release.uncertainty.bounds === "required" &&
    (row.scoreLower == null || row.scoreUpper == null)
  ) {
    errors.push("release requires both score bounds");
  }
  if (
    release.uncertainty.bounds === "absent" &&
    (row.scoreLower != null || row.scoreUpper != null)
  ) {
    errors.push("release forbids score bounds");
  }
  if (
    row.scoreLower != null &&
    row.scoreUpper != null &&
    (row.scoreLower > row.score || row.scoreUpper < row.score || row.scoreLower > row.scoreUpper)
  ) {
    errors.push("score bounds do not contain the point estimate");
  }
  if (
    row.derivationVersions.methodology.state !== "versioned" ||
    row.derivationVersions.methodology.id !== release.methodologyVersion
  ) {
    errors.push("derivation methodology mismatch");
  }
  if (
    row.derivationVersions.algorithm.state !== "versioned" ||
    row.derivationVersions.algorithm.id !== release.compositeAlgorithmVersion
  ) {
    errors.push("derivation algorithm mismatch");
  }
  const allowedSources = new Set(
    release.dimensions.map((dimension) => dimension.sourceId),
  );
  if (
    row.derivationVersions.sourceIds.length === 0 ||
    row.derivationVersions.sourceIds.some(
      (sourceId) => !allowedSources.has(sourceId),
    )
  ) {
    errors.push("derivation source basket is outside the release set");
  }
  const canonicalSourceIds = [
    ...new Set(row.derivationVersions.sourceIds),
  ].sort();
  if (
    JSON.stringify(row.derivationVersions.sourceIds) !==
    JSON.stringify(canonicalSourceIds)
  ) {
    errors.push("derivation source ids are not canonical");
  }
  const missing = new Set(row.missingDimensions ?? []);
  const requiredSources = new Set(["worldbank_wgi"]);
  if (!missing.has("freedom_rights")) requiredSources.add("freedom_house");
  if (!missing.has("corruption_control"))
    requiredSources.add("transparency_intl");
  for (const sourceId of requiredSources) {
    if (!canonicalSourceIds.includes(sourceId))
      errors.push(`composite source basket is missing ${sourceId}`);
  }
  if (missing.has("freedom_rights") && canonicalSourceIds.includes("freedom_house"))
    errors.push("composite source basket includes a missing freedom dimension");
  if (
    missing.has("corruption_control") &&
    canonicalSourceIds.includes("transparency_intl")
  ) {
    errors.push("composite source basket includes a missing corruption dimension");
  }
  if (missing.has("democratic_quality") || missing.has("rule_of_law"))
    errors.push("composite is missing a mandatory dimension");
  if (row.dimensionsAvailable !== 4 - missing.size)
    errors.push("composite dimension count disagrees with missing dimensions");
  if (
    (missing.size === 0 && (row.isPartial || row.completenessFlag !== "full")) ||
    (missing.size > 0 && (!row.isPartial || row.completenessFlag !== "partial"))
  ) {
    errors.push("composite completeness flags disagree with missing dimensions");
  }
  const expectedSourceBasket = row.derivationVersions.sourceIds.length
    ? sourceBasketVersion(row.derivationVersions.sourceIds).id
    : null;
  if (
    !expectedSourceBasket ||
    row.derivationVersions.sourceBasket.state !== "versioned" ||
    row.derivationVersions.sourceBasket.id !== expectedSourceBasket
  ) {
    errors.push("derivation source-basket hash mismatch");
  }
  try {
    const expected = ciVersionEnvelope({
      methodologyVersion: release.methodologyVersion,
      algorithmVersion: release.compositeAlgorithmVersion,
      sourceIds: canonicalSourceIds,
    });
    if (stableStringify(row.derivationVersions) !== stableStringify(expected.envelope))
      errors.push("composite derivation envelope differs from the release method");
    if (row.derivationVersionKey !== expected.key)
      errors.push("composite derivation key differs from the release method");
  } catch {
    errors.push("composite derivation envelope is invalid");
  }
  const expectedContentHash = indexContentHash(row);
  if (row.contentHash !== expectedContentHash)
    errors.push("composite content hash mismatch");
  return errors;
}

export function assertCiReleaseCompositeRow<T extends CiReleaseCompositeRow>(
  row: T,
  releaseId: string = CURRENT_CI_RELEASE_ID,
): T {
  const release = resolveCiRelease(releaseId);
  const errors = ciReleaseCompositeRowErrors(row, release);
  if (errors.length) {
    throw new CiReleaseConsistencyError(
      `${release.releaseId}/${row.jurisdictionId}: ${errors.join(", ")}`,
    );
  }
  return row;
}

export function ciReleaseForCoordinates(methodologyVersion: string, quarter: string): CiReleaseContract {
  const matches = CI_RELEASE_CONTRACTS.filter(
    (row) => row.methodologyVersion === methodologyVersion && row.quarter === quarter,
  );
  if (matches.length === 0)
    throw new Error(`No closed Civica Index release for ${methodologyVersion}/${quarter}`);
  if (matches.length > 1)
    throw new CiReleaseConsistencyError(
      `Multiple Civica Index releases share ${methodologyVersion}/${quarter}; select an exact release id`,
    );
  return matches[0];
}

export interface CiReleaseDimensionRow {
  releaseId: string | null;
  jurisdictionId: string;
  dimension: string;
  quarter: string;
  sourceId: string;
  indicatorId: string;
  methodologyVersion: string;
  transformationId: string;
  methodVersion: string;
  artifactHash: string;
  upstreamRelease: string;
  artifactKind: string;
  temporalCoverage: string;
  licenseUrl: string;
  substitutionReason: string | null;
  derivationVersionKey: string;
  derivationVersions: DerivationVersionEnvelope;
  rawValue: number | null;
  normalizedScore: number;
  [key: string]: unknown;
}

function matchingRule(row: CiReleaseDimensionRow, release: CiReleaseContract): CiReleaseDimensionRule | undefined {
  return release.dimensions.find(
    (rule) =>
      rule.dimension === row.dimension &&
      rule.sourceId === row.sourceId &&
      rule.indicatorId === row.indicatorId &&
      rule.artifactSha256 === row.artifactHash,
  );
}

export function ciReleaseDimensionRowErrors(row: CiReleaseDimensionRow, release: CiReleaseContract): string[] {
  const errors = derivationVersionErrors(row.derivationVersions, {
    allowLegacy: false,
  });
  if (row.releaseId !== release.releaseId) errors.push("release id mismatch");
  if (row.methodologyVersion !== release.methodologyVersion) errors.push("methodology version mismatch");
  if (row.quarter !== release.quarter) errors.push("release quarter mismatch");
  const rule = matchingRule(row, release);
  if (!rule) errors.push("source/indicator/artifact identity is outside the release set");
  if (rule && row.upstreamRelease !== rule.upstreamRelease)
    errors.push("upstream release identity mismatch");
  if (rule && row.artifactKind !== rule.artifactKind)
    errors.push("artifact kind mismatch");
  if (rule && row.temporalCoverage !== rule.temporalCoverage)
    errors.push("temporal coverage mismatch");
  if (rule && row.licenseUrl !== rule.licenseUrl)
    errors.push("source license URL mismatch");
  if (rule && row.substitutionReason !== rule.substitutionReason)
    errors.push("source substitution reason mismatch");
  if (row.transformationId !== `${release.inputTransformationVersion}:${row.dimension}`) errors.push("input transformation version mismatch");
  if (row.methodVersion !== release.methodologyVersion) errors.push("row method version mismatch");
  try {
    const expected = ciVersionEnvelope({
      methodologyVersion: release.methodologyVersion,
      algorithmVersion: release.inputTransformationVersion,
      sourceIds: [row.sourceId],
    });
    if (row.derivationVersionKey !== expected.key)
      errors.push("row derivation key mismatch");
    if (stableStringify(row.derivationVersions) !== stableStringify(expected.envelope))
      errors.push("row derivation envelope mismatch");
  } catch {
    errors.push("row derivation identity is invalid");
  }
  return errors;
}

export function selectCiReleaseDimensionRows<T extends CiReleaseDimensionRow>(
  rows: readonly T[],
  releaseId: string = CURRENT_CI_RELEASE_ID,
): T[] {
  const release = resolveCiRelease(releaseId);
  const coordinateRows = rows.filter(
    (row) => row.methodologyVersion === release.methodologyVersion && row.quarter === release.quarter,
  );
  for (const row of coordinateRows) {
    const errors = ciReleaseDimensionRowErrors(row, release);
    if (errors.length > 0) {
      throw new CiReleaseConsistencyError(
        `${release.releaseId}/${row.jurisdictionId}/${row.dimension}: ${errors.join(", ")}`,
      );
    }
  }
  const selected = new Map<string, { row: T; priority: number }>();
  for (const row of coordinateRows) {
    const rule = matchingRule(row, release)!;
    const key = `${row.jurisdictionId}:${row.dimension}`;
    const prior = selected.get(key);
    if (!prior || rule.priority < prior.priority) selected.set(key, { row, priority: rule.priority });
    else if (rule.priority === prior.priority) {
      throw new CiReleaseConsistencyError(
        `${release.releaseId}/${key}: duplicate release identity`,
      );
    }
  }
  return [...selected.values()].map((entry) => entry.row).sort((a, b) =>
    `${a.jurisdictionId}:${a.dimension}`.localeCompare(`${b.jurisdictionId}:${b.dimension}`),
  );
}

export function displayCiReleaseDimensionScore(
  row: CiReleaseDimensionRow,
  releaseId: string = CURRENT_CI_RELEASE_ID,
): number | null {
  const release = resolveCiRelease(releaseId);
  const errors = ciReleaseDimensionRowErrors(row, release);
  if (errors.length > 0) {
    throw new CiReleaseConsistencyError(
      `${release.releaseId} display row: ${errors.join(", ")}`,
    );
  }
  if (row.rawValue == null || Number.isNaN(row.rawValue)) return null;
  return normalizeV2(row.rawValue, row.sourceId);
}

export function ciReleaseContractErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const release of CI_RELEASE_CONTRACTS) {
    if (ids.has(release.releaseId))
      errors.push(`duplicate release ${release.releaseId}`);
    ids.add(release.releaseId);
    if (!/^ci-[a-z0-9-]+-\d{4}-Q[1-4]$/.test(release.releaseId))
      errors.push(`${release.releaseId} has an invalid release id`);
    if (!/^\d{4}-Q[1-4]$/.test(release.quarter))
      errors.push(`${release.releaseId} has an invalid quarter`);
    for (const [label, hash] of [
      ["input manifest", release.inputManifestSha256],
      ["methodology content", release.methodologyContentSha256],
      ["dimension row set", release.dimensionRowSet.sha256],
      ["composite row set", release.compositeRowSet.sha256],
    ] as const) {
      if (!/^[a-f0-9]{64}$/.test(hash))
        errors.push(`${release.releaseId} has an invalid ${label} hash`);
    }
    if (release.dimensionRowSet.rows <= 0)
      errors.push(`${release.releaseId} has no dimension rows`);
    if (release.compositeRowSet.rows <= 0)
      errors.push(`${release.releaseId} has no composite rows`);
    const expectedMethodologyContentHash = frozenContentHash({
      id: release.methodologyVersion,
      weights: V2_WEIGHTS,
    });
    if (release.methodologyContentSha256 !== expectedMethodologyContentHash)
      errors.push(`${release.releaseId} methodology weights drifted`);
    if (
      release.supersessionKind === "none" &&
      (release.supersedesReleaseId != null || release.supersedesVintageLabel != null)
    ) {
      errors.push(`${release.releaseId} has unexpected supersession identity`);
    }
    if (
      release.supersessionKind === "registered_release" &&
      (release.supersedesReleaseId == null || release.supersedesVintageLabel == null)
    ) {
      errors.push(`${release.releaseId} has an incomplete registered supersession`);
    }
    if (
      release.supersessionKind === "legacy_unregistered_vintage" &&
      (release.supersedesReleaseId != null || release.supersedesVintageLabel == null)
    ) {
      errors.push(`${release.releaseId} has an invalid legacy supersession`);
    }
    if (release.supersedesReleaseId === release.releaseId)
      errors.push(`${release.releaseId} cannot supersede itself`);
    if (release.supersessionKind === "registered_release" && release.supersedesReleaseId) {
      const predecessor = CI_RELEASE_CONTRACTS.find(
        (candidate) => candidate.releaseId === release.supersedesReleaseId,
      );
      if (!predecessor)
        errors.push(`${release.releaseId} supersedes an unknown release`);
      else if (predecessor.vintageLabel !== release.supersedesVintageLabel)
        errors.push(`${release.releaseId} superseded vintage label drifted`);
    }
    if (
      release.uncertainty.bounds === "required" !==
      (release.uncertainty.displayedRange !== "not_published")
    ) {
      errors.push(`${release.releaseId} uncertainty range/bounds disagree`);
    }
    if (
      (release.uncertainty.simulations > 0) !==
      (release.uncertainty.pointEstimate === "seeded_simulation_median")
    ) {
      errors.push(`${release.releaseId} uncertainty simulation policy disagrees`);
    }
    if (release.dimensions.length !== 5)
      errors.push(`${release.releaseId} must pin five source identities`);
    const dimensionIdentities = new Set<string>();
    const dimensionPriorities = new Set<string>();
    for (const dimension of release.dimensions) {
      const identity = `${dimension.dimension}:${dimension.sourceId}:${dimension.indicatorId}`;
      if (dimensionIdentities.has(identity))
        errors.push(`${release.releaseId} repeats source identity ${identity}`);
      dimensionIdentities.add(identity);
      const priority = `${dimension.dimension}:${dimension.priority}`;
      if (dimensionPriorities.has(priority))
        errors.push(`${release.releaseId} repeats priority ${priority}`);
      dimensionPriorities.add(priority);
      if (!/^[a-f0-9]{64}$/.test(dimension.artifactSha256))
        errors.push(`${release.releaseId}/${identity} has an invalid artifact hash`);
      if (!dimension.upstreamRelease.trim())
        errors.push(`${release.releaseId}/${identity} has no upstream release`);
      if (dimension.artifactKind !== "publisher_bytes")
        errors.push(`${release.releaseId}/${identity} has an invalid artifact kind`);
      if (dimension.temporalCoverage !== "2024")
        errors.push(`${release.releaseId}/${identity} has invalid temporal coverage`);
      if (!dimension.licenseUrl.startsWith("https://"))
        errors.push(`${release.releaseId}/${identity} has an invalid license URL`);
    }
    if (release.series.releaseId !== release.releaseId)
      errors.push(`${release.releaseId} series release id mismatch`);
    for (const error of ciSeriesProvenanceErrors(release.series))
      errors.push(`${release.releaseId}: ${error}`);
  }
  if (resolveCiRelease().quarter !== CURRENT_CI_QUARTER)
    errors.push("current release quarter drifted");
  return errors;
}
