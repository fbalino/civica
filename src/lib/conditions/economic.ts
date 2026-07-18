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

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stddev(values: readonly number[], average: number): number {
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) || 1;
}

function normalCdf(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

type EconomicStats = {
  inflationMean: number;
  inflationStddev: number;
  unemploymentMean: number;
  unemploymentStddev: number;
  gdpGrowthMean: number;
  gdpGrowthStddev: number;
};

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

function economicStats(observations: readonly EconomicObservation[]): EconomicStats {
  const inflationValues = observations.map((observation) => observation.inflation.value!);
  const unemploymentValues = observations.map((observation) => observation.unemployment.value!);
  const gdpGrowthValues = observations.map((observation) => observation.gdpGrowth.value!);
  const inflationMean = mean(inflationValues);
  const unemploymentMean = mean(unemploymentValues);
  const gdpGrowthMean = mean(gdpGrowthValues);
  return {
    inflationMean,
    inflationStddev: stddev(inflationValues, inflationMean),
    unemploymentMean,
    unemploymentStddev: stddev(unemploymentValues, unemploymentMean),
    gdpGrowthMean,
    gdpGrowthStddev: stddev(gdpGrowthValues, gdpGrowthMean),
  };
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
 * The frozen cross-country reference sets for economic normalization. Each
 * period has its own population and parameters: values from a newer period
 * cannot move an earlier period's distribution.
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
    .map(([year, group]) => {
      const statistics = economicStats(group);
      return {
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
            direction: "lower_is_better" as const,
            transformationId: "conditions-economic-aligned-z-cdf/v2",
            mean: statistics.inflationMean,
            standardDeviation: statistics.inflationStddev,
            lowerBound: null,
            upperBound: null,
          },
          {
            componentId: "unemployment" as const,
            direction: "lower_is_better" as const,
            transformationId: "conditions-economic-aligned-z-cdf/v2",
            mean: statistics.unemploymentMean,
            standardDeviation: statistics.unemploymentStddev,
            lowerBound: null,
            upperBound: null,
          },
          {
            componentId: "gdp_growth" as const,
            direction: "higher_is_better" as const,
            transformationId: "conditions-economic-aligned-z-cdf/v2",
            mean: statistics.gdpGrowthMean,
            standardDeviation: statistics.gdpGrowthStddev,
            lowerBound: null,
            upperBound: null,
          },
        ],
      } satisfies ConditionsReferenceSet;
    })
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
 * Builds decomposable economic Conditions calculations. Scores are created
 * only when all three declared inputs are observed in the same reference year;
 * missing or mixed-year candidates remain persisted as unavailable ledgers.
 */
export function buildEconomicConditionsCalculations(input: {
  observations: readonly EconomicObservation[];
  releaseId: string;
  methodologyVersion: string;
  lineages: EconomicLineages;
}): ConditionScoreInput[] {
  const statsByYear = new Map(
    [...groupAlignedObservations(input.observations)].map(([year, group]) => [
      year,
      economicStats(group),
    ]),
  );

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
    const statistics = statsByYear.get(referenceYear);
    if (!statistics) {
      throw new Error(`Missing frozen economic reference set for ${referenceYear}`);
    }
    const compositeZ = mean([
      -(observation.inflation.value! - statistics.inflationMean) / statistics.inflationStddev,
      -(observation.unemployment.value! - statistics.unemploymentMean) / statistics.unemploymentStddev,
      (observation.gdpGrowth.value! - statistics.gdpGrowthMean) / statistics.gdpGrowthStddev,
    ]);
    const normalizedScore = Math.round(normalCdf(compositeZ) * 1000) / 10;
    const rawValue = Math.round(compositeZ * 1000) / 1000;
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
      normalizedScore,
      rawValue,
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
