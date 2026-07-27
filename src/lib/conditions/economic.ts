import type { DataValueStatus } from "@/lib/data/value-state";
import type { IndicatorLineage } from "@/lib/indicators/lineage";
import {
  CONDITIONS_ALIGNMENT_POLICY,
  conditionCalculationKey,
  type ConditionScoreInput,
  type ConditionsComponentId,
} from "./contract";
import {
  CONDITIONS_MISSINGNESS_POLICY,
  type ConditionsReferenceSet,
} from "./release";

export interface EconomicComponentObservation {
  value: number | null;
  referenceYear: number | null;
  valueStatus: DataValueStatus;
  valueStatusReason: string | null;
}

export interface EconomicObservation {
  jurisdictionId: string;
  inflation: EconomicComponentObservation;
  unemployment: EconomicComponentObservation;
  gdpGrowth: EconomicComponentObservation;
}

export interface EconomicLineages {
  score: IndicatorLineage;
  components: Record<
    "inflation" | "unemployment" | "gdp_growth",
    IndicatorLineage
  >;
}

function alignedReferenceYear(observation: EconomicObservation): number | null {
  const components = [
    observation.inflation,
    observation.unemployment,
    observation.gdpGrowth,
  ];
  if (!components.every((component) => component.valueStatus === "observed")) {
    return null;
  }
  const years = new Set(components.map((component) => component.referenceYear));
  return years.size === 1 ? observation.inflation.referenceYear : null;
}

function groupAlignedObservations(
  observations: readonly EconomicObservation[],
): Map<number, EconomicObservation[]> {
  const byYear = new Map<number, EconomicObservation[]>();
  for (const observation of observations) {
    const year = alignedReferenceYear(observation);
    if (year === null) continue;
    const group = byYear.get(year) ?? [];
    group.push(observation);
    byYear.set(year, group);
  }
  return byYear;
}

/**
 * Frozen, per-year source-native economic populations. There is no authorized
 * scalar transformation: the registry preserves the exact components and
 * candidate population needed for ATL-028 without equating GDP growth with
 * economic stability.
 */
export function buildEconomicReferenceSets(
  observations: readonly EconomicObservation[],
): ConditionsReferenceSet[] {
  const groups = groupAlignedObservations(observations);
  const mixedYearRefusedCount = observations.filter((observation) => {
    const components = [
      observation.inflation,
      observation.unemployment,
      observation.gdpGrowth,
    ];
    return (
      components.every((component) => component.valueStatus === "observed") &&
      new Set(components.map((component) => component.referenceYear)).size > 1
    );
  }).length;
  const missingComponentCount = observations.length -
    [...groups.values()].reduce((count, group) => count + group.length, 0) -
    mixedYearRefusedCount;

  return [...groups.entries()]
    .map(([year, group]) => ({
        dimension: "economic_stability" as const,
        referencePeriod: `${year}-Q4`,
        jurisdictionIds: group.map((observation) => observation.jurisdictionId).sort(),
        candidateCount: observations.length,
        alignedCount: group.length,
        mixedYearRefusedCount,
        missingComponentCount,
        includedComponents: ["inflation", "unemployment", "gdp_growth"] as const,
        missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
        parameters: [
          {
            componentId: "inflation" as const,
            direction: "not_ranked" as const,
            transformationId: "conditions-economic-source-native/v1",
            mean: null,
            standardDeviation: null,
            lowerBound: null,
            upperBound: null,
          },
          {
            componentId: "unemployment" as const,
            direction: "not_ranked" as const,
            transformationId: "conditions-economic-source-native/v1",
            mean: null,
            standardDeviation: null,
            lowerBound: null,
            upperBound: null,
          },
          {
            componentId: "gdp_growth" as const,
            direction: "not_ranked" as const,
            transformationId: "conditions-economic-source-native/v1",
            mean: null,
            standardDeviation: null,
            lowerBound: null,
            upperBound: null,
          },
        ],
      } satisfies ConditionsReferenceSet))
    .sort((left, right) => left.referencePeriod.localeCompare(right.referencePeriod));
}

function component(
  componentId: ConditionsComponentId,
  nativeUnit: string,
  observation: EconomicComponentObservation,
  lineage: IndicatorLineage,
  inclusionDecision: "included" | "excluded_missing" | "refused_mixed_year",
) {
  return {
    componentId,
    sourceId: "worldbank_economic",
    nativeValue: observation.value,
    nativeUnit,
    referenceYear: observation.referenceYear,
    valueStatus: observation.valueStatus,
    valueStatusReason: observation.valueStatusReason,
    inclusionDecision,
    ...lineage,
  } as const;
}

function draftComponents(
  observation: EconomicObservation,
  lineages: EconomicLineages,
  inclusionDecision: "included" | "excluded_missing" | "refused_mixed_year",
) {
  return [
    component(
      "inflation",
      "percent_annual_change",
      observation.inflation,
      lineages.components.inflation,
      inclusionDecision,
    ),
    component(
      "unemployment",
      "percent_labor_force",
      observation.unemployment,
      lineages.components.unemployment,
      inclusionDecision,
    ),
    component(
      "gdp_growth",
      "percent_annual_change",
      observation.gdpGrowth,
      lineages.components.gdp_growth,
      inclusionDecision,
    ),
  ];
}

function unavailableCalculation(
  observation: EconomicObservation,
  releaseId: string,
  methodologyVersion: string,
  lineages: EconomicLineages,
): ConditionScoreInput {
  const sourceObservations = [
    observation.inflation,
    observation.unemployment,
    observation.gdpGrowth,
  ];
  const allObserved = sourceObservations.every(
    (component) => component.valueStatus === "observed",
  );
  const observedYears = new Set(
    sourceObservations
      .filter((component) => component.valueStatus === "observed")
      .map((component) => component.referenceYear),
  );
  const alignmentStatus: "mixed_year_refused" | "missing_component" =
    allObserved && observedYears.size > 1
      ? "mixed_year_refused"
      : "missing_component";
  const components = draftComponents(
    observation,
    lineages,
    alignmentStatus === "mixed_year_refused"
      ? "refused_mixed_year"
      : "excluded_missing",
  );
  const base = {
    releaseId,
    jurisdictionId: observation.jurisdictionId,
    dimension: "economic_stability" as const,
    quarter: null,
    normalizedScore: null,
    rawValue: null,
    sourceId: "worldbank_economic",
    datasetYear: null,
    methodologyVersion,
    referenceYear: null,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus,
    components,
    ...lineages.score,
  };
  return {
    ...base,
    calculationKey: conditionCalculationKey(base),
  };
}

/**
 * Builds decomposable economic Conditions calculations. An aligned native
 * ledger is retained only when all inputs share one reference year. It
 * deliberately emits no score until ATL-028 validates a longitudinal construct.
 */
export function buildEconomicConditionsCalculations(input: {
  observations: readonly EconomicObservation[];
  releaseId: string;
  methodologyVersion: string;
  lineages: EconomicLineages;
}): ConditionScoreInput[] {
  return input.observations.map((observation) => {
    const components = [
      observation.inflation,
      observation.unemployment,
      observation.gdpGrowth,
    ];
    const allObserved = components.every(
      (component) => component.valueStatus === "observed",
    );
    const years = new Set(components.map((component) => component.referenceYear));
    if (!allObserved || years.size !== 1) {
      return unavailableCalculation(
        observation,
        input.releaseId,
        input.methodologyVersion,
        input.lineages,
      );
    }

    const referenceYear = observation.inflation.referenceYear!;
    const calculationComponents = draftComponents(
      observation,
      input.lineages,
      "included",
    );
    const base = {
      releaseId: input.releaseId,
      jurisdictionId: observation.jurisdictionId,
      dimension: "economic_stability" as const,
      quarter: `${referenceYear}-Q4`,
      normalizedScore: null,
      rawValue: null,
      sourceId: "worldbank_economic",
      datasetYear: referenceYear,
      methodologyVersion: input.methodologyVersion,
      referenceYear,
      alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
      alignmentStatus: "aligned" as const,
      components: calculationComponents,
      ...input.lineages.score,
    };
    return {
      ...base,
      calculationKey: conditionCalculationKey(base),
    };
  });
}
