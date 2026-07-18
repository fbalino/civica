import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";
import type {
  ConditionScoreInput,
  ConditionsComponentId,
  ConditionsDimension,
} from "./contract";

export const CONDITIONS_RELEASE_SCHEMA_VERSION =
  "conditions-release/v1" as const;
export const CONDITIONS_MISSINGNESS_POLICY =
  "no-imputation-all-declared-components-observed-same-reference-year/v1" as const;

export const CONDITIONS_DIRECTIONS = [
  "higher_is_better",
  "lower_is_better",
] as const;
export type ConditionsDirection = (typeof CONDITIONS_DIRECTIONS)[number];

export interface ConditionsNormalizationParameter {
  componentId: ConditionsComponentId;
  direction: ConditionsDirection;
  transformationId: string;
  mean: number | null;
  standardDeviation: number | null;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface ConditionsReferenceSet {
  dimension: ConditionsDimension;
  referencePeriod: string;
  /** Exact, sorted eligible population used to derive the parameters. */
  jurisdictionIds: readonly string[];
  candidateCount: number;
  alignedCount: number;
  mixedYearRefusedCount: number;
  missingComponentCount: number;
  includedComponents: readonly ConditionsComponentId[];
  missingnessPolicy: typeof CONDITIONS_MISSINGNESS_POLICY;
  parameters: readonly ConditionsNormalizationParameter[];
}

export interface ConditionsReleaseInput {
  releaseId: string;
  methodologyVersion: string;
  referenceSets: readonly ConditionsReferenceSet[];
}

export interface ConditionsReleaseManifest {
  schemaVersion: typeof CONDITIONS_RELEASE_SCHEMA_VERSION;
  releaseId: string;
  methodologyVersion: string;
  referenceSets: Array<{
    dimension: ConditionsDimension;
    referencePeriod: string;
    jurisdictionIds: string[];
    candidateCount: number;
    alignedCount: number;
    mixedYearRefusedCount: number;
    missingComponentCount: number;
    includedComponents: ConditionsComponentId[];
    missingnessPolicy: typeof CONDITIONS_MISSINGNESS_POLICY;
    parameters: ConditionsNormalizationParameter[];
  }>;
  calculationKeys: string[];
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function orderedParameters(
  parameters: readonly ConditionsNormalizationParameter[],
): ConditionsNormalizationParameter[] {
  return [...parameters]
    .map((parameter) => ({ ...parameter }))
    .sort((left, right) => left.componentId.localeCompare(right.componentId));
}

function orderedReferenceSets(
  referenceSets: readonly ConditionsReferenceSet[],
): ConditionsReleaseManifest["referenceSets"] {
  return [...referenceSets]
    .map((referenceSet) => ({
      dimension: referenceSet.dimension,
      referencePeriod: referenceSet.referencePeriod,
      jurisdictionIds: [...referenceSet.jurisdictionIds].sort(),
      candidateCount: referenceSet.candidateCount,
      alignedCount: referenceSet.alignedCount,
      mixedYearRefusedCount: referenceSet.mixedYearRefusedCount,
      missingComponentCount: referenceSet.missingComponentCount,
      includedComponents: [...referenceSet.includedComponents].sort(),
      missingnessPolicy: referenceSet.missingnessPolicy,
      parameters: orderedParameters(referenceSet.parameters),
    }))
    .sort(
      (left, right) =>
        `${left.dimension}:${left.referencePeriod}`.localeCompare(
          `${right.dimension}:${right.referencePeriod}`,
        ),
    );
}

export function conditionsReferencePopulationSha256(
  jurisdictionIds: readonly string[],
): string {
  return sha256([...jurisdictionIds].sort());
}

export function conditionsReleaseManifest(
  release: ConditionsReleaseInput,
  calculations: readonly ConditionScoreInput[],
): ConditionsReleaseManifest {
  return {
    schemaVersion: CONDITIONS_RELEASE_SCHEMA_VERSION,
    releaseId: release.releaseId,
    methodologyVersion: release.methodologyVersion,
    referenceSets: orderedReferenceSets(release.referenceSets),
    calculationKeys: calculations
      .map((calculation) => calculation.calculationKey)
      .sort(),
  };
}

export function conditionsReleaseManifestSha256(
  release: ConditionsReleaseInput,
  calculations: readonly ConditionScoreInput[],
): string {
  return sha256(conditionsReleaseManifest(release, calculations));
}

export function conditionsReleaseErrors(
  release: ConditionsReleaseInput,
  calculations: readonly ConditionScoreInput[],
): string[] {
  const errors: string[] = [];
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(release.releaseId)) {
    errors.push("releaseId must be a stable conditions-*-vN identifier");
  }
  if (!release.methodologyVersion.trim()) errors.push("methodologyVersion is blank");
  const referenceKeys = new Set<string>();
  for (const referenceSet of release.referenceSets) {
    const key = `${referenceSet.dimension}:${referenceSet.referencePeriod}`;
    if (referenceKeys.has(key)) errors.push(`duplicate reference set: ${key}`);
    referenceKeys.add(key);
    if (!/^\d{4}-Q[1-4]$/.test(referenceSet.referencePeriod)) {
      errors.push(`${key}: referencePeriod is invalid`);
    }
    const sortedIds = [...referenceSet.jurisdictionIds].sort();
    if (
      sortedIds.length === 0 ||
      sortedIds.some((id) => !id.trim()) ||
      new Set(sortedIds).size !== sortedIds.length
    ) {
      errors.push(`${key}: reference population must be non-empty and unique`);
    }
    if (referenceSet.alignedCount !== sortedIds.length) {
      errors.push(`${key}: alignedCount must equal the frozen reference population`);
    }
    if (
      referenceSet.candidateCount < referenceSet.alignedCount ||
      referenceSet.mixedYearRefusedCount < 0 ||
      referenceSet.missingComponentCount < 0
    ) {
      errors.push(`${key}: missingness counts are invalid`);
    }
    if (referenceSet.missingnessPolicy !== CONDITIONS_MISSINGNESS_POLICY) {
      errors.push(`${key}: missingness policy is invalid`);
    }
    if (
      new Set(referenceSet.includedComponents).size !==
        referenceSet.includedComponents.length ||
      referenceSet.includedComponents.length === 0
    ) {
      errors.push(`${key}: included components are invalid`);
    }
    if (referenceSet.parameters.length !== referenceSet.includedComponents.length) {
      errors.push(`${key}: every included component needs one parameter row`);
    }
    for (const parameter of referenceSet.parameters) {
      if (!referenceSet.includedComponents.includes(parameter.componentId)) {
        errors.push(`${key}: parameter ${parameter.componentId} is not included`);
      }
      if (!CONDITIONS_DIRECTIONS.includes(parameter.direction)) {
        errors.push(`${key}: parameter ${parameter.componentId} has invalid direction`);
      }
      if (!parameter.transformationId.trim()) {
        errors.push(`${key}: parameter ${parameter.componentId} has no transform`);
      }
      for (const [name, value] of Object.entries({
        mean: parameter.mean,
        standardDeviation: parameter.standardDeviation,
        lowerBound: parameter.lowerBound,
        upperBound: parameter.upperBound,
      })) {
        if (value !== null && !Number.isFinite(value)) {
          errors.push(`${key}: parameter ${parameter.componentId} ${name} is not finite`);
        }
      }
      if (
        parameter.standardDeviation !== null &&
        parameter.standardDeviation <= 0
      ) {
        errors.push(`${key}: parameter ${parameter.componentId} standardDeviation must be positive`);
      }
      if (
        parameter.lowerBound !== null &&
        parameter.upperBound !== null &&
        parameter.lowerBound >= parameter.upperBound
      ) {
        errors.push(`${key}: parameter ${parameter.componentId} bounds are invalid`);
      }
    }
  }
  if (release.referenceSets.length === 0) errors.push("release has no reference sets");
  if (calculations.length === 0) errors.push("release has no calculations");
  if (calculations.some((calculation) => calculation.releaseId !== release.releaseId)) {
    errors.push("calculation releaseId does not match the release");
  }
  if (
    calculations.some(
      (calculation) => calculation.methodologyVersion !== release.methodologyVersion,
    )
  ) {
    errors.push("calculation methodologyVersion does not match the release");
  }
  return errors;
}

/** Builds frozen reference sets for a one-component fixed-bound dimension. */
export function buildFixedBoundReferenceSets(input: {
  calculations: readonly ConditionScoreInput[];
  componentId: ConditionsComponentId;
  direction: ConditionsDirection;
  transformationId: string;
  lowerBound: number;
  upperBound: number;
}): ConditionsReferenceSet[] {
  const byPeriod = new Map<string, ConditionScoreInput[]>();
  for (const calculation of input.calculations) {
    if (calculation.alignmentStatus !== "aligned" || !calculation.quarter) continue;
    const group = byPeriod.get(calculation.quarter) ?? [];
    group.push(calculation);
    byPeriod.set(calculation.quarter, group);
  }
  return [...byPeriod.entries()].map(([referencePeriod, aligned]) => ({
    dimension: aligned[0].dimension,
    referencePeriod,
    jurisdictionIds: aligned.map((calculation) => calculation.jurisdictionId).sort(),
    candidateCount: input.calculations.length,
    alignedCount: aligned.length,
    mixedYearRefusedCount: input.calculations.filter(
      (calculation) => calculation.alignmentStatus === "mixed_year_refused",
    ).length,
    missingComponentCount: input.calculations.filter(
      (calculation) => calculation.alignmentStatus === "missing_component",
    ).length,
    includedComponents: [input.componentId],
    missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
    parameters: [{
      componentId: input.componentId,
      direction: input.direction,
      transformationId: input.transformationId,
      mean: null,
      standardDeviation: null,
      lowerBound: input.lowerBound,
      upperBound: input.upperBound,
    }],
  }));
}
