import {
  V2_DIMENSIONS,
  V2_MANDATORY,
  type CIDimensionV2,
} from "./dimensions-v2";
import { CURRENT_CI_METHODOLOGY_VERSION } from "./current-release";

export type CiCompletenessFlag = "full" | "partial" | "insufficient";

/** The complete, version-bound publication policy for current Index rows. */
export const CURRENT_CI_MISSINGNESS_POLICY = Object.freeze({
  schemaVersion: "ci-missingness-policy/v1" as const,
  id: "ci-missingness/v1" as const,
  methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION,
  dimensions: V2_DIMENSIONS,
  mandatoryDimensions: V2_MANDATORY,
  optionalDimensions: Object.freeze(
    V2_DIMENSIONS.filter((dimension) => !V2_MANDATORY.includes(dimension)),
  ),
  minimumDimensionsForPublication: 3 as const,
  maximumMissingOptionalDimensions: 1 as const,
  partialWeightTreatment: "renormalize_present_weights_to_one" as const,
  partialRangeMultiplier: null,
  partialComparability:
    "not_directly_comparable_to_full_estimates_without_the_missingness_flag" as const,
  insufficientTreatment: "withhold_composite" as const,
});

export interface CiCompletenessAssessment {
  completeness: CiCompletenessFlag;
  present: CIDimensionV2[];
  missing: CIDimensionV2[];
  missingMandatory: CIDimensionV2[];
  missingOptional: CIDimensionV2[];
}

export function assessCiCompleteness(
  presentInput: ReadonlySet<string>,
): CiCompletenessAssessment {
  const present = V2_DIMENSIONS.filter((dimension) => presentInput.has(dimension));
  const missing = V2_DIMENSIONS.filter((dimension) => !presentInput.has(dimension));
  const missingMandatory = V2_MANDATORY.filter(
    (dimension) => !presentInput.has(dimension),
  );
  const missingOptional = missing.filter(
    (dimension) => !V2_MANDATORY.includes(dimension),
  );
  const publishable =
    missingMandatory.length === 0 &&
    present.length >= CURRENT_CI_MISSINGNESS_POLICY.minimumDimensionsForPublication &&
    missingOptional.length <=
      CURRENT_CI_MISSINGNESS_POLICY.maximumMissingOptionalDimensions;

  return {
    completeness: !publishable
      ? "insufficient"
      : missing.length === 0
        ? "full"
        : "partial",
    present,
    missing,
    missingMandatory,
    missingOptional,
  };
}

export function parsePublishedCiCompleteness(input: {
  completenessFlag: string | null;
  dimensionsAvailable: number | null;
  missingDimensions: string[] | null;
}): {
  completenessFlag: "full" | "partial";
  dimensionsAvailable: 3 | 4;
  missingDimensions: CIDimensionV2[];
} {
  const missing = input.missingDimensions ?? [];
  if (
    missing.some(
      (dimension) => !(V2_DIMENSIONS as readonly string[]).includes(dimension),
    ) ||
    new Set(missing).size !== missing.length
  ) {
    throw new Error("Published Index row has invalid missing dimensions");
  }
  const assessment = assessCiCompleteness(
    new Set(V2_DIMENSIONS.filter((dimension) => !missing.includes(dimension))),
  );
  if (
    assessment.completeness === "insufficient" ||
    input.completenessFlag !== assessment.completeness ||
    input.dimensionsAvailable !== assessment.present.length
  ) {
    throw new Error("Published Index row contradicts the current missingness policy");
  }
  return {
    completenessFlag: assessment.completeness,
    dimensionsAvailable: assessment.present.length as 3 | 4,
    missingDimensions: missing as CIDimensionV2[],
  };
}
