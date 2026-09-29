import type { CivicaCalculationOrigin } from "@/lib/provenance/publisher-attribution";

import {
  CONDITIONS_DIMENSIONS,
  type ConditionsAlignmentStatus,
  type ConditionsDimension,
} from "./contract";

export const CONDITIONS_PUBLIC_RELEASE_CONTRACT =
  "civica-conditions-public-release/v1" as const;

export interface ConditionsPublicReleaseHeader {
  releaseId: string;
  methodologyVersion: string;
  manifestSha256: string;
  createdAt: string;
}

export interface ConditionsPublicComponent {
  componentId: string;
  nativeValue: number | null;
  nativeUnit: string;
  referenceYear: number | null;
  valueStatus: string;
  valueStatusReason: string | null;
  inclusionDecision: string;
  sourceId: string;
  sourceName: string | null;
  indicatorId: string;
  upstreamRelease: string;
  licenseUrl: string;
  transformationId: string;
}

export interface ConditionsPublicCalculation {
  releaseId: string;
  jurisdictionId: string;
  countryName: string;
  countrySlug: string;
  countryIso3: string | null;
  dimension: ConditionsDimension;
  calculationKey: string;
  alignmentPolicy: string;
  alignmentStatus: ConditionsAlignmentStatus;
  referenceYear: number | null;
  /** Civica's 0 to 100 position: a Civica calculation, never the
   *  publisher's figure (which is `rawValue` and the component value). */
  normalizedScore: number | null;
  rawValue: number | null;
  /** publisher-attribution/v1 origin of `normalizedScore`: every scored
   *  position is a registered Civica calculation; unscored rows carry null. */
  scoreOrigin: CivicaCalculationOrigin | null;
  scoreSourceId: string | null;
  scoreSourceName: string | null;
  scoreIndicatorId: string | null;
  scoreUpstreamRelease: string | null;
  scoreLicenseUrl: string | null;
  components: readonly ConditionsPublicComponent[];
}

/**
 * A calculation row as stored: the score's transformation identifier before
 * it becomes the public `scoreOrigin`.
 */
export type ConditionsStoredCalculation = Omit<
  ConditionsPublicCalculation,
  "scoreOrigin"
> & { scoreTransformationId: string | null };

export interface ConditionsDimensionCoverage {
  dimension: ConditionsDimension;
  calculations: number;
  aligned: number;
  scored: number;
  mixedYearRefused: number;
  missingComponent: number;
  components: number;
  observedComponents: number;
  unavailableComponents: number;
}

export interface ConditionsPublicRelease {
  contract: typeof CONDITIONS_PUBLIC_RELEASE_CONTRACT;
  release: ConditionsPublicReleaseHeader;
  coverage: readonly ConditionsDimensionCoverage[];
  calculations: readonly ConditionsPublicCalculation[];
}

/**
 * Selects one immutable Conditions release. The default is the latest stored
 * release, with stable ID ordering only as a deterministic timestamp tie-break.
 */
export function selectConditionsPublicRelease(
  releases: readonly ConditionsPublicReleaseHeader[],
  requestedReleaseId?: string | null,
): ConditionsPublicReleaseHeader | null {
  if (requestedReleaseId) {
    return releases.find((release) => release.releaseId === requestedReleaseId) ?? null;
  }
  return [...releases]
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.releaseId.localeCompare(left.releaseId),
    )
    .at(0) ?? null;
}

export function conditionsPublicReleaseErrors(input: {
  release: ConditionsPublicReleaseHeader;
  calculations: readonly ConditionsStoredCalculation[];
}): string[] {
  const errors: string[] = [];
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(input.release.releaseId)) {
    errors.push("release has an invalid ID");
  }
  if (!/^[a-f0-9]{64}$/.test(input.release.manifestSha256)) {
    errors.push("release has an invalid manifest hash");
  }
  if (!input.release.methodologyVersion.trim()) {
    errors.push("release has no methodology version");
  }
  for (const calculation of input.calculations) {
    if (calculation.releaseId !== input.release.releaseId) {
      errors.push(`${calculation.calculationKey}: calculation belongs to another release`);
    }
    if (!CONDITIONS_DIMENSIONS.includes(calculation.dimension)) {
      errors.push(`${calculation.calculationKey}: unknown Conditions dimension`);
    }
    if (calculation.alignmentStatus === "aligned" && calculation.referenceYear === null) {
      errors.push(`${calculation.calculationKey}: aligned calculation has no reference year`);
    }
    if (calculation.alignmentStatus !== "aligned" && calculation.normalizedScore !== null) {
      errors.push(`${calculation.calculationKey}: unaligned calculation carries a score`);
    }
    if (
      calculation.dimension === "economic_stability" &&
      calculation.normalizedScore !== null
    ) {
      errors.push(
        `${calculation.calculationKey}: economic stability must not publish a composite score`,
      );
    }
    if (new Set(calculation.components.map((component) => component.componentId)).size !== calculation.components.length) {
      errors.push(`${calculation.calculationKey}: duplicate component ID`);
    }
    if (calculation.normalizedScore !== null && !calculation.scoreTransformationId) {
      errors.push(`${calculation.calculationKey}: scored calculation has no transformation id`);
    }
    if (calculation.normalizedScore === null && calculation.scoreTransformationId !== null) {
      errors.push(`${calculation.calculationKey}: unscored calculation carries a transformation id`);
    }
  }
  return errors;
}

function dimensionCoverage(
  dimension: ConditionsDimension,
  calculations: readonly ConditionsPublicCalculation[],
): ConditionsDimensionCoverage {
  const scoped = calculations.filter((calculation) => calculation.dimension === dimension);
  const components = scoped.flatMap((calculation) => calculation.components);
  return {
    dimension,
    calculations: scoped.length,
    aligned: scoped.filter((calculation) => calculation.alignmentStatus === "aligned").length,
    scored: scoped.filter((calculation) => calculation.normalizedScore !== null).length,
    mixedYearRefused: scoped.filter((calculation) => calculation.alignmentStatus === "mixed_year_refused").length,
    missingComponent: scoped.filter((calculation) => calculation.alignmentStatus === "missing_component").length,
    components: components.length,
    observedComponents: components.filter((component) => component.valueStatus === "observed").length,
    unavailableComponents: components.filter((component) => component.valueStatus !== "observed").length,
  };
}

/**
 * Produces the release-selected public model used by the Conditions reader
 * and API. Coverage comes only from its calculation rows; it intentionally
 * has no general-country denominator or cross-dimension composite. Every
 * scored position carries its Civica-calculation origin (CLM-020).
 */
export function buildConditionsPublicRelease(input: {
  release: ConditionsPublicReleaseHeader;
  calculations: readonly ConditionsStoredCalculation[];
}): ConditionsPublicRelease {
  const errors = conditionsPublicReleaseErrors(input);
  if (errors.length) {
    throw new Error(`Invalid Conditions public release: ${errors.join(", ")}`);
  }
  const calculations: ConditionsPublicCalculation[] = input.calculations.map(
    ({ scoreTransformationId, ...calculation }) => ({
      ...calculation,
      scoreOrigin:
        calculation.normalizedScore === null || scoreTransformationId === null
          ? null
          : { kind: "civica_calculation", transformationId: scoreTransformationId },
    }),
  );
  return {
    contract: CONDITIONS_PUBLIC_RELEASE_CONTRACT,
    release: input.release,
    coverage: CONDITIONS_DIMENSIONS.map((dimension) =>
      dimensionCoverage(dimension, calculations),
    ),
    calculations: calculations.sort(
      (left, right) =>
        left.countryName.localeCompare(right.countryName) ||
        left.dimension.localeCompare(right.dimension),
    ),
  };
}
