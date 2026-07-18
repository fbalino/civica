import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";
import {
  DATA_VALUE_STATUSES,
  type DataValueStatus,
  validateDataValueState,
} from "@/lib/data/value-state";
import {
  indicatorLineageErrors,
  type IndicatorLineage,
} from "@/lib/indicators/lineage";

export const CURRENT_CONDITIONS_METHODOLOGY_VERSION =
  "conditions-components/v1" as const;
export const CONDITIONS_ALIGNMENT_POLICY =
  "all-components-same-reference-year/v1" as const;

export const CONDITIONS_DIMENSIONS = [
  "human_development",
  "peace_security",
  "economic_stability",
] as const;
export type ConditionsDimension = (typeof CONDITIONS_DIMENSIONS)[number];

export const CONDITIONS_COMPONENTS = {
  human_development: ["hdi"] as const,
  peace_security: ["global_peace_index"] as const,
  economic_stability: [
    "inflation",
    "unemployment",
    "gdp_growth",
  ] as const,
} as const;

export type ConditionsComponentId =
  (typeof CONDITIONS_COMPONENTS)[ConditionsDimension][number];

export const CONDITIONS_ALIGNMENT_STATUSES = [
  "aligned",
  "mixed_year_refused",
  "missing_component",
] as const;
export type ConditionsAlignmentStatus =
  (typeof CONDITIONS_ALIGNMENT_STATUSES)[number];

export const CONDITIONS_INCLUSION_DECISIONS = [
  "included",
  "excluded_missing",
  "refused_mixed_year",
] as const;
export type ConditionsInclusionDecision =
  (typeof CONDITIONS_INCLUSION_DECISIONS)[number];

export interface ConditionsComponentInput extends IndicatorLineage {
  componentId: ConditionsComponentId;
  sourceId: string;
  nativeValue: number | null;
  nativeUnit: string;
  referenceYear: number | null;
  valueStatus: DataValueStatus;
  valueStatusReason: string | null;
  inclusionDecision: ConditionsInclusionDecision;
}

export interface ConditionScoreInput extends IndicatorLineage {
  calculationKey: string;
  releaseId: string;
  jurisdictionId: string;
  dimension: ConditionsDimension;
  quarter: string | null;
  normalizedScore: number | null;
  rawValue: number | null;
  sourceId: string;
  datasetYear: number | null;
  methodologyVersion: string;
  referenceYear: number | null;
  alignmentPolicy: typeof CONDITIONS_ALIGNMENT_POLICY;
  alignmentStatus: ConditionsAlignmentStatus;
  components: readonly ConditionsComponentInput[];
}

export function conditionCalculationKey(input: {
  releaseId: string;
  jurisdictionId: string;
  dimension: ConditionsDimension;
  methodologyVersion: string;
  alignmentStatus: ConditionsAlignmentStatus;
  referenceYear: number | null;
  components: readonly ConditionsComponentInput[];
}): string {
  const payload = {
    releaseId: input.releaseId,
    jurisdictionId: input.jurisdictionId,
    dimension: input.dimension,
    methodologyVersion: input.methodologyVersion,
    alignmentStatus: input.alignmentStatus,
    referenceYear: input.referenceYear,
    components: [...input.components]
      .map((component) => ({
        componentId: component.componentId,
        nativeValue: component.nativeValue,
        nativeUnit: component.nativeUnit,
        referenceYear: component.referenceYear,
        valueStatus: component.valueStatus,
        valueStatusReason: component.valueStatusReason,
        inclusionDecision: component.inclusionDecision,
        sourceId: component.sourceId,
        indicatorId: component.indicatorId,
        artifactHash: component.artifactHash,
        transformationId: component.transformationId,
      }))
      .sort((a, b) => a.componentId.localeCompare(b.componentId)),
  };
  return `conditions-calculation/v1/sha256:${createHash("sha256")
    .update(stableStringify(payload))
    .digest("hex")}`;
}

function requiredComponents(dimension: ConditionsDimension): readonly string[] {
  return CONDITIONS_COMPONENTS[dimension];
}

export function conditionCalculationErrors(input: ConditionScoreInput): string[] {
  const errors: string[] = [];
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(input.releaseId)) {
    errors.push("releaseId is invalid");
  }
  if (!input.jurisdictionId.trim()) errors.push("jurisdictionId is blank");
  if (!input.methodologyVersion.trim()) errors.push("methodologyVersion is blank");
  if (!/^conditions-calculation\/v1\/sha256:[a-f0-9]{64}$/.test(input.calculationKey)) {
    errors.push("calculationKey is invalid");
  }
  if (!CONDITIONS_ALIGNMENT_STATUSES.includes(input.alignmentStatus)) {
    errors.push("alignmentStatus is invalid");
  }
  if (input.alignmentPolicy !== CONDITIONS_ALIGNMENT_POLICY) {
    errors.push("alignmentPolicy is invalid");
  }
  if (new Set(input.components.map((component) => component.componentId)).size !== input.components.length) {
    errors.push("components contain a duplicate componentId");
  }
  const required = [...requiredComponents(input.dimension)].sort();
  const actual = input.components.map((component) => component.componentId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    errors.push(`components must be exactly ${required.join(", ")}`);
  }

  for (const component of input.components) {
    if (!component.nativeUnit.trim()) {
      errors.push(`${component.componentId}: nativeUnit is blank`);
    }
    if (!DATA_VALUE_STATUSES.includes(component.valueStatus)) {
      errors.push(`${component.componentId}: valueStatus is invalid`);
    }
    errors.push(
      ...validateDataValueState({
        status: component.valueStatus,
        hasValue: component.nativeValue !== null,
        reason: component.valueStatusReason,
      }).map((error) => `${component.componentId}: ${error}`),
    );
    if (component.nativeValue !== null && !Number.isFinite(component.nativeValue)) {
      errors.push(`${component.componentId}: nativeValue is not finite`);
    }
    if (
      (component.valueStatus === "observed" || component.valueStatus === "disputed") &&
      (!Number.isInteger(component.referenceYear) || component.referenceYear! < 1800 || component.referenceYear! > 2200)
    ) {
      errors.push(`${component.componentId}: observed value requires a valid referenceYear`);
    }
    if (component.valueStatus !== "observed" && component.referenceYear !== null) {
      errors.push(`${component.componentId}: unavailable value must not carry a referenceYear`);
    }
    for (const lineageError of indicatorLineageErrors(component)) {
      errors.push(`${component.componentId}: ${lineageError}`);
    }
  }

  const observed = input.components.filter(
    (component) => component.valueStatus === "observed",
  );
  const observedYears = new Set(observed.map((component) => component.referenceYear));
  const allObserved = observed.length === input.components.length;

  if (input.alignmentStatus === "aligned") {
    if (!allObserved || observedYears.size !== 1) {
      errors.push("aligned calculation requires all components observed in one reference year");
    }
    const [referenceYear] = observedYears;
    if (input.referenceYear !== referenceYear || input.datasetYear !== referenceYear) {
      errors.push("aligned calculation referenceYear and datasetYear must equal the component year");
    }
    if (!input.quarter || input.quarter !== `${referenceYear}-Q4`) {
      errors.push("aligned calculation quarter must match its reference year");
    }
    if (input.dimension === "economic_stability") {
      // ATL-028: aligned source inputs are retained without asserting that a
      // current-year growth value establishes a stability score.
      if (input.normalizedScore !== null || input.rawValue !== null) {
        errors.push("economic stability has no score before construct validation");
      }
    } else {
      if (!Number.isFinite(input.normalizedScore) || input.normalizedScore! < 0 || input.normalizedScore! > 100) {
        errors.push("aligned calculation requires a normalized 0–100 score");
      }
      if (!Number.isFinite(input.rawValue)) {
        errors.push("aligned calculation requires a finite raw value");
      }
    }
    if (input.components.some((component) => component.inclusionDecision !== "included")) {
      errors.push("aligned calculation must include every component");
    }
  } else {
    if (input.normalizedScore !== null || input.rawValue !== null || input.quarter !== null || input.datasetYear !== null || input.referenceYear !== null) {
      errors.push("unavailable calculation must not carry score or aggregate-year fields");
    }
    if (input.alignmentStatus === "mixed_year_refused") {
      if (!allObserved || observedYears.size < 2) {
        errors.push("mixed_year_refused requires observed components in multiple years");
      }
      if (input.components.some((component) => component.inclusionDecision !== "refused_mixed_year")) {
        errors.push("mixed_year_refused must refuse every component");
      }
    }
    if (input.alignmentStatus === "missing_component") {
      if (allObserved) errors.push("missing_component requires an unavailable component");
      if (input.components.some((component) => component.inclusionDecision !== "excluded_missing")) {
        errors.push("missing_component must exclude every component");
      }
    }
  }

  return errors;
}
