import { CI_INGEST_ALGORITHM_VERSION, CI_BETA_COMPOSITE_ALGORITHM_VERSION } from "./versioning";
import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_QUARTER,
  CURRENT_CI_RELEASE_ID,
  CURRENT_CI_VINTAGE_LABEL,
} from "./current-release";
import { normalizeV2 } from "./normalize-v2";

export type CiReleaseDimensionRule = {
  dimension: string;
  sourceId: string;
  indicatorId: string;
  priority: number;
  artifactSha256: string;
};

export type CiReleaseContract = {
  releaseId: string;
  methodologyVersion: string;
  quarter: string;
  vintageLabel: string;
  inputTransformationVersion: string;
  compositeAlgorithmVersion: string;
  displayTransformVersion: string;
  dimensions: readonly CiReleaseDimensionRule[];
};

const INPUT_HASHES = {
  vdem: "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
  worldbank_wgi: "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8",
  freedom_house: "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88",
  transparency_intl: "34d1c16eb3c5b04cad2cf116c852dfc4ab8144b1c66cb37c74011848639f5736",
} as const;

const DIMENSION_RULES: readonly CiReleaseDimensionRule[] = [
  { dimension: "democratic_quality", sourceId: "vdem", indicatorId: "v2x_libdem", priority: 1, artifactSha256: INPUT_HASHES.vdem },
  { dimension: "democratic_quality", sourceId: "worldbank_wgi", indicatorId: "va.est", priority: 2, artifactSha256: INPUT_HASHES.worldbank_wgi },
  { dimension: "rule_of_law", sourceId: "worldbank_wgi", indicatorId: "rl.est", priority: 1, artifactSha256: INPUT_HASHES.worldbank_wgi },
  { dimension: "freedom_rights", sourceId: "freedom_house", indicatorId: "fh_pr_cl_sum", priority: 1, artifactSha256: INPUT_HASHES.freedom_house },
  { dimension: "corruption_control", sourceId: "transparency_intl", indicatorId: "CPI_SCORE", priority: 1, artifactSha256: INPUT_HASHES.transparency_intl },
] as const;

function betaRelease(releaseId: string, methodologyVersion: string, vintageLabel: string, compositeAlgorithmVersion: string): CiReleaseContract {
  return Object.freeze({
    releaseId,
    methodologyVersion,
    quarter: "2024-Q4",
    vintageLabel,
    inputTransformationVersion: CI_INGEST_ALGORITHM_VERSION,
    compositeAlgorithmVersion,
    displayTransformVersion: "ci-display/fixed-native-bounds-v1",
    dimensions: DIMENSION_RULES,
  });
}

export const CI_RELEASE_CONTRACTS = Object.freeze([
  betaRelease("ci-beta-r3-2024-Q4", "beta-r3", "Civica Index 2024 Q4 (Beta-R3)", "ci-composite/fixed-bounds-seeded-simulation-r3"),
  betaRelease("ci-beta-r4-2024-Q4", "beta-r4", "Civica Index 2024 Q4 (Beta-R4)", "ci-composite/fixed-bounds-weighted-r4"),
  betaRelease(CURRENT_CI_RELEASE_ID, CURRENT_CI_METHODOLOGY_VERSION, CURRENT_CI_VINTAGE_LABEL, CI_BETA_COMPOSITE_ALGORITHM_VERSION),
] as const);

export function resolveCiRelease(releaseId: string = CURRENT_CI_RELEASE_ID): CiReleaseContract {
  const release = CI_RELEASE_CONTRACTS.find((row) => row.releaseId === releaseId);
  if (!release) throw new Error(`Unknown Civica Index release: ${releaseId}`);
  return release;
}

export function ciReleaseForCoordinates(methodologyVersion: string, quarter: string): CiReleaseContract {
  const release = CI_RELEASE_CONTRACTS.find(
    (row) => row.methodologyVersion === methodologyVersion && row.quarter === quarter,
  );
  if (!release) throw new Error(`No closed Civica Index release for ${methodologyVersion}/${quarter}`);
  return release;
}

export interface CiReleaseDimensionRow {
  jurisdictionId: string;
  dimension: string;
  quarter: string;
  sourceId: string;
  indicatorId: string;
  methodologyVersion: string;
  transformationId: string;
  methodVersion: string;
  artifactHash: string;
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
  const errors: string[] = [];
  if (row.methodologyVersion !== release.methodologyVersion) errors.push("methodology version mismatch");
  if (row.quarter !== release.quarter) errors.push("release quarter mismatch");
  const rule = matchingRule(row, release);
  if (!rule) errors.push("source/indicator/artifact identity is outside the release set");
  if (row.transformationId !== `${release.inputTransformationVersion}:${row.dimension}`) errors.push("input transformation version mismatch");
  if (row.methodVersion !== release.methodologyVersion) errors.push("row method version mismatch");
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
    if (errors.length > 0) throw new Error(`${release.releaseId}/${row.jurisdictionId}/${row.dimension}: ${errors.join(", ")}`);
  }
  const selected = new Map<string, { row: T; priority: number }>();
  for (const row of coordinateRows) {
    const rule = matchingRule(row, release)!;
    const key = `${row.jurisdictionId}:${row.dimension}`;
    const prior = selected.get(key);
    if (!prior || rule.priority < prior.priority) selected.set(key, { row, priority: rule.priority });
    else if (rule.priority === prior.priority) throw new Error(`${release.releaseId}/${key}: duplicate release identity`);
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
  if (errors.length > 0) throw new Error(`${release.releaseId} display row: ${errors.join(", ")}`);
  if (row.rawValue == null || Number.isNaN(row.rawValue)) return null;
  return normalizeV2(row.rawValue, row.sourceId);
}

export function ciReleaseContractErrors(): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const coordinates = new Set<string>();
  for (const release of CI_RELEASE_CONTRACTS) {
    if (ids.has(release.releaseId)) errors.push(`duplicate release ${release.releaseId}`);
    ids.add(release.releaseId);
    const coordinate = `${release.methodologyVersion}:${release.quarter}`;
    if (coordinates.has(coordinate)) errors.push(`duplicate release coordinates ${coordinate}`);
    coordinates.add(coordinate);
    if (release.dimensions.length !== 5) errors.push(`${release.releaseId} must pin five source identities`);
  }
  if (resolveCiRelease().quarter !== CURRENT_CI_QUARTER) errors.push("current release quarter drifted");
  return errors;
}
