import { createHash } from "node:crypto";

import { stableStringify } from "@/lib/data/frozen-vintage";

export const ECONOMIC_STABILITY_CONSTRUCT_STUDY_SCHEMA =
  "economic-stability-construct-study/v1" as const;
export const ECONOMIC_STABILITY_WINDOWS = [5, 10] as const;

export interface FrozenEconomicObservation {
  jurisdictionId: string;
  year: number;
  inflation: number;
  unemployment: number;
  gdpGrowth: number;
}

export interface EconomicVolatilityBaseline {
  sourceId: string;
  indicatorId: string;
  sourceUrl: string;
  artifactHash: string;
  values: readonly {
    jurisdictionId: string;
    year: number;
    value: number;
  }[];
}

export interface EconomicConstructCounterexample {
  id: string;
  jurisdictionId: string;
  kind: "recovery" | "boom";
  rationaleUrl: string;
}

/**
 * The analysis input is deliberately detached from a mutable database query.
 * A caller must first freeze the Conditions release and its input manifest,
 * then supply only the values covered by those hashes.
 */
export interface EconomicStabilityConstructStudyInput {
  schemaVersion: typeof ECONOMIC_STABILITY_CONSTRUCT_STUDY_SCHEMA;
  studyId: string;
  conditionsReleaseId: string;
  conditionsReleaseManifestSha256: string;
  sourceInputManifestSha256: string;
  methodologyVersion: string;
  analysisYear: number;
  observations: readonly FrozenEconomicObservation[];
  /** The native World Bank series remain the default public presentation. */
  nativeBaseline: {
    sourceId: "worldbank_economic";
    inflationIndicatorId: "FP.CPI.TOTL.ZG";
    unemploymentIndicatorId: "SL.UEM.TOTL.ZS";
    gdpGrowthIndicatorId: "NY.GDP.MKTP.KD.ZG";
  };
  externalVolatilityBaseline?: EconomicVolatilityBaseline;
  counterexamples: readonly EconomicConstructCounterexample[];
}

type BenchmarkRow = {
  jurisdictionId: string;
  inflation: number;
  unemployment: number;
  gdpGrowth: number;
  legacyBenchmark: number;
  rank: number;
};

type VolatilityProfile = {
  jurisdictionId: string;
  windowYears: number;
  inflationLevel: number;
  unemploymentLevel: number;
  gdpGrowth: number;
  inflationVolatility: number;
  unemploymentVolatility: number;
  growthVolatility: number;
  downsideYears: number;
};

export interface EconomicStabilityConstructStudyResult {
  schemaVersion: typeof ECONOMIC_STABILITY_CONSTRUCT_STUDY_SCHEMA;
  studyId: string;
  conditionsReleaseId: string;
  conditionsReleaseManifestSha256: string;
  sourceInputManifestSha256: string;
  methodologyVersion: string;
  analysisYear: number;
  inputSha256: string;
  nativeBaseline: EconomicStabilityConstructStudyInput["nativeBaseline"];
  coverage: {
    currentYearJurisdictions: number;
    longitudinal: Array<{ windowYears: number; jurisdictions: number }>;
  };
  /** A reproducible diagnostic only; never a public Conditions score. */
  legacyAnnualBenchmark: {
    definition: string;
    rows: BenchmarkRow[];
    rankCorrelationWithCurrentGrowth: number | null;
    leaveOneComponentRankCorrelations: Array<{
      removedComponent: "inflation" | "unemployment" | "gdp_growth";
      correlation: number | null;
    }>;
  };
  volatilityProfiles: Array<{
    windowYears: number;
    rows: VolatilityProfile[];
  }>;
  externalVolatilityComparison:
    | { status: "not_provided"; comparisons: [] }
    | {
      status: "compared";
      sourceId: string;
      indicatorId: string;
      artifactHash: string;
      comparisons: Array<{
        windowYears: number;
        matchedJurisdictions: number;
        rankCorrelationWithGrowthVolatility: number | null;
      }>;
    };
  counterexamples: Array<{
    id: string;
    jurisdictionId: string;
    kind: "recovery" | "boom";
    rationaleUrl: string;
    legacyBenchmarkRank: number | null;
    growthVolatility5Year: number | null;
    growthVolatility10Year: number | null;
  }>;
  resolution: {
    publicPresentation: "source_native_separate_indicators";
    compositeStatus: "not_authorized";
    reason: string;
  };
  resultSha256: string;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function round(value: number, places = 8): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function ranks(values: readonly { id: string; value: number }[]): Map<string, number> {
  const ordered = [...values].sort((left, right) =>
    left.value === right.value
      ? left.id.localeCompare(right.id)
      : left.value - right.value,
  );
  const result = new Map<string, number>();
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].value === ordered[start].value) end += 1;
    const averageRank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) {
      result.set(ordered[index].id, averageRank);
    }
    start = end;
  }
  return result;
}

function spearman(values: readonly { left: number; right: number; id: string }[]): number | null {
  if (values.length < 3) return null;
  const leftRanks = ranks(values.map((value) => ({ id: value.id, value: value.left })));
  const rightRanks = ranks(values.map((value) => ({ id: value.id, value: value.right })));
  const left = values.map((value) => leftRanks.get(value.id)!);
  const right = values.map((value) => rightRanks.get(value.id)!);
  const leftDeviation = standardDeviation(left);
  const rightDeviation = standardDeviation(right);
  if (leftDeviation === 0 || rightDeviation === 0) return null;
  const covariance = mean(left.map((value, index) =>
    (value - mean(left)) * (right[index] - mean(right)),
  ));
  return round(covariance / (leftDeviation * rightDeviation));
}

function currentYearObservations(input: EconomicStabilityConstructStudyInput): FrozenEconomicObservation[] {
  return input.observations
    .filter((observation) => observation.year === input.analysisYear)
    .sort((left, right) => left.jurisdictionId.localeCompare(right.jurisdictionId));
}

function canonicalStudyInput(input: EconomicStabilityConstructStudyInput) {
  return {
    ...input,
    observations: [...input.observations].sort((left, right) =>
      `${left.jurisdictionId}:${left.year}`.localeCompare(`${right.jurisdictionId}:${right.year}`),
    ),
    counterexamples: [...input.counterexamples].sort((left, right) => left.id.localeCompare(right.id)),
    externalVolatilityBaseline: input.externalVolatilityBaseline
      ? {
        ...input.externalVolatilityBaseline,
        values: [...input.externalVolatilityBaseline.values].sort((left, right) =>
          `${left.jurisdictionId}:${left.year}`.localeCompare(`${right.jurisdictionId}:${right.year}`),
        ),
      }
      : undefined,
  };
}

function legacyBenchmark(rows: readonly FrozenEconomicObservation[]): BenchmarkRow[] {
  if (rows.length === 0) return [];
  const inflationMean = mean(rows.map((row) => row.inflation));
  const unemploymentMean = mean(rows.map((row) => row.unemployment));
  const growthMean = mean(rows.map((row) => row.gdpGrowth));
  const inflationDeviation = standardDeviation(rows.map((row) => row.inflation)) || 1;
  const unemploymentDeviation = standardDeviation(rows.map((row) => row.unemployment)) || 1;
  const growthDeviation = standardDeviation(rows.map((row) => row.gdpGrowth)) || 1;
  const calculated = rows.map((row) => ({
    jurisdictionId: row.jurisdictionId,
    inflation: row.inflation,
    unemployment: row.unemployment,
    gdpGrowth: row.gdpGrowth,
    legacyBenchmark: round((
      -(row.inflation - inflationMean) / inflationDeviation
      - (row.unemployment - unemploymentMean) / unemploymentDeviation
      + (row.gdpGrowth - growthMean) / growthDeviation
    ) / 3),
  }));
  const ranking = ranks(calculated.map((row) => ({
    id: row.jurisdictionId,
    value: -row.legacyBenchmark,
  })));
  return calculated.map((row) => ({ ...row, rank: ranking.get(row.jurisdictionId)! }));
}

function profileForWindow(
  input: EconomicStabilityConstructStudyInput,
  windowYears: number,
): VolatilityProfile[] {
  const startYear = input.analysisYear - windowYears + 1;
  const byJurisdiction = new Map<string, Map<number, FrozenEconomicObservation>>();
  for (const observation of input.observations) {
    const years = byJurisdiction.get(observation.jurisdictionId) ?? new Map();
    years.set(observation.year, observation);
    byJurisdiction.set(observation.jurisdictionId, years);
  }
  const rows: VolatilityProfile[] = [];
  for (const [jurisdictionId, observations] of byJurisdiction) {
    const series = Array.from({ length: windowYears }, (_, index) =>
      observations.get(startYear + index),
    );
    if (series.some((observation) => !observation)) continue;
    const complete = series as FrozenEconomicObservation[];
    const current = complete.at(-1)!;
    rows.push({
      jurisdictionId,
      windowYears,
      inflationLevel: current.inflation,
      unemploymentLevel: current.unemployment,
      gdpGrowth: current.gdpGrowth,
      inflationVolatility: round(standardDeviation(complete.map((row) => row.inflation))),
      unemploymentVolatility: round(standardDeviation(complete.map((row) => row.unemployment))),
      growthVolatility: round(standardDeviation(complete.map((row) => row.gdpGrowth))),
      downsideYears: complete.filter((row) => row.gdpGrowth < 0).length,
    });
  }
  return rows.sort((left, right) => left.jurisdictionId.localeCompare(right.jurisdictionId));
}

function leaveOneComponentCorrelations(rows: readonly BenchmarkRow[]) {
  const components = ["inflation", "unemployment", "gdp_growth"] as const;
  return components.map((removedComponent) => {
    const remaining = components.filter((component) => component !== removedComponent);
    const replacement = rows.map((row) => ({
      id: row.jurisdictionId,
      left: row.legacyBenchmark,
      right: mean(remaining.map((component) => {
        if (component === "inflation") return -row.inflation;
        if (component === "unemployment") return -row.unemployment;
        return row.gdpGrowth;
      })),
    }));
    return { removedComponent, correlation: spearman(replacement) };
  });
}

export function economicStabilityConstructStudyErrors(
  input: EconomicStabilityConstructStudyInput,
): string[] {
  const errors: string[] = [];
  if (input.schemaVersion !== ECONOMIC_STABILITY_CONSTRUCT_STUDY_SCHEMA) {
    errors.push("schemaVersion is invalid");
  }
  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(input.conditionsReleaseId)) {
    errors.push("conditionsReleaseId is invalid");
  }
  if (!input.studyId.trim() || !input.methodologyVersion.trim()) {
    errors.push("studyId and methodologyVersion are required");
  }
  if (!Number.isInteger(input.analysisYear) || input.analysisYear < 1800 || input.analysisYear > 2200) {
    errors.push("analysisYear is invalid");
  }
  for (const [name, value] of Object.entries({
    conditionsReleaseManifestSha256: input.conditionsReleaseManifestSha256,
    sourceInputManifestSha256: input.sourceInputManifestSha256,
  })) {
    if (!/^[a-f0-9]{64}$/.test(value)) errors.push(`${name} must be a SHA-256`);
  }
  const observationKeys = new Set<string>();
  for (const observation of input.observations) {
    const key = `${observation.jurisdictionId}:${observation.year}`;
    if (!observation.jurisdictionId.trim() || observationKeys.has(key)) {
      errors.push(`observation ${key} is blank or duplicated`);
    }
    observationKeys.add(key);
    if (!Number.isInteger(observation.year) || observation.year < 1800 || observation.year > input.analysisYear) {
      errors.push(`observation ${key} has an invalid year`);
    }
    for (const [component, value] of Object.entries({
      inflation: observation.inflation,
      unemployment: observation.unemployment,
      gdpGrowth: observation.gdpGrowth,
    })) {
      if (!Number.isFinite(value)) errors.push(`observation ${key} ${component} is not finite`);
    }
  }
  if (input.observations.length === 0) errors.push("observations are required");
  const currentJurisdictions = new Set(
    input.observations
      .filter((observation) => observation.year === input.analysisYear)
      .map((observation) => observation.jurisdictionId),
  );
  if (currentJurisdictions.size < 3) {
    errors.push("at least three current-year jurisdictions are required for rank comparisons");
  }
  if (
    input.nativeBaseline.sourceId !== "worldbank_economic" ||
    input.nativeBaseline.inflationIndicatorId !== "FP.CPI.TOTL.ZG" ||
    input.nativeBaseline.unemploymentIndicatorId !== "SL.UEM.TOTL.ZS" ||
    input.nativeBaseline.gdpGrowthIndicatorId !== "NY.GDP.MKTP.KD.ZG"
  ) {
    errors.push("nativeBaseline must identify the declared World Bank component series");
  }
  const counterexampleIds = new Set<string>();
  for (const counterexample of input.counterexamples) {
    if (!counterexample.id.trim() || counterexampleIds.has(counterexample.id)) {
      errors.push("counterexample ids must be present and unique");
    }
    counterexampleIds.add(counterexample.id);
    if (!counterexample.jurisdictionId.trim() || !/^https:\/\//.test(counterexample.rationaleUrl)) {
      errors.push(`counterexample ${counterexample.id} lacks a jurisdiction or HTTPS rationale`);
    }
    if (!currentJurisdictions.has(counterexample.jurisdictionId)) {
      errors.push(`counterexample ${counterexample.id} has no current-year observation`);
    }
  }
  for (const kind of ["recovery", "boom"] as const) {
    if (!input.counterexamples.some((counterexample) => counterexample.kind === kind)) {
      errors.push(`a documented ${kind} counterexample is required`);
    }
  }
  if (input.externalVolatilityBaseline) {
    const baseline = input.externalVolatilityBaseline;
    if (!baseline.sourceId.trim() || !baseline.indicatorId.trim() || !/^https:\/\//.test(baseline.sourceUrl)) {
      errors.push("externalVolatilityBaseline lacks source metadata");
    }
    if (!/^[a-f0-9]{64}$/.test(baseline.artifactHash)) {
      errors.push("externalVolatilityBaseline artifactHash must be a SHA-256");
    }
    const baselineKeys = new Set<string>();
    for (const value of baseline.values) {
      const key = `${value.jurisdictionId}:${value.year}`;
      if (!value.jurisdictionId.trim() || baselineKeys.has(key) || !Number.isFinite(value.value)) {
        errors.push(`external baseline ${key} is invalid or duplicated`);
      }
      baselineKeys.add(key);
    }
  }
  return errors;
}

export function analyzeEconomicStabilityConstruct(
  input: EconomicStabilityConstructStudyInput,
): EconomicStabilityConstructStudyResult {
  const errors = economicStabilityConstructStudyErrors(input);
  if (errors.length > 0) throw new Error(`Invalid economic stability construct study: ${errors.join("; ")}`);

  const currentRows = currentYearObservations(input);
  const benchmarkRows = legacyBenchmark(currentRows);
  const profiles = ECONOMIC_STABILITY_WINDOWS.map((windowYears) => ({
    windowYears,
    rows: profileForWindow(input, windowYears),
  }));
  const benchmarkByJurisdiction = new Map(
    benchmarkRows.map((row) => [row.jurisdictionId, row]),
  );
  const profilesByWindow = new Map(
    profiles.map((profile) => [profile.windowYears, new Map(profile.rows.map((row) => [row.jurisdictionId, row]))]),
  );
  const externalVolatilityComparison = input.externalVolatilityBaseline
    ? {
      status: "compared" as const,
      sourceId: input.externalVolatilityBaseline.sourceId,
      indicatorId: input.externalVolatilityBaseline.indicatorId,
      artifactHash: input.externalVolatilityBaseline.artifactHash,
      comparisons: profiles.map(({ windowYears, rows }) => {
        const external = new Map(
          input.externalVolatilityBaseline!.values
            .filter((value) => value.year === input.analysisYear)
            .map((value) => [value.jurisdictionId, value.value]),
        );
        const paired = rows
          .filter((row) => external.has(row.jurisdictionId))
          .map((row) => ({
            id: row.jurisdictionId,
            left: row.growthVolatility,
            right: external.get(row.jurisdictionId)!,
          }));
        return {
          windowYears,
          matchedJurisdictions: paired.length,
          rankCorrelationWithGrowthVolatility: spearman(paired),
        };
      }),
    }
    : { status: "not_provided" as const, comparisons: [] as [] };

  const body = {
    schemaVersion: ECONOMIC_STABILITY_CONSTRUCT_STUDY_SCHEMA,
    studyId: input.studyId,
    conditionsReleaseId: input.conditionsReleaseId,
    conditionsReleaseManifestSha256: input.conditionsReleaseManifestSha256,
    sourceInputManifestSha256: input.sourceInputManifestSha256,
    methodologyVersion: input.methodologyVersion,
    analysisYear: input.analysisYear,
    inputSha256: sha256(canonicalStudyInput(input)),
    nativeBaseline: input.nativeBaseline,
    coverage: {
      currentYearJurisdictions: currentRows.length,
      longitudinal: profiles.map(({ windowYears, rows }) => ({ windowYears, jurisdictions: rows.length })),
    },
    legacyAnnualBenchmark: {
      definition: "Previously proposed equal-weight, current-year inflation, unemployment, and GDP-growth z-score diagnostic; not an economic-stability measure or public score.",
      rows: benchmarkRows,
      rankCorrelationWithCurrentGrowth: spearman(benchmarkRows.map((row) => ({
        id: row.jurisdictionId,
        left: row.legacyBenchmark,
        right: row.gdpGrowth,
      }))),
      leaveOneComponentRankCorrelations: leaveOneComponentCorrelations(benchmarkRows),
    },
    volatilityProfiles: profiles,
    externalVolatilityComparison,
    counterexamples: [...input.counterexamples]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((counterexample) => ({
        ...counterexample,
        legacyBenchmarkRank: benchmarkByJurisdiction.get(counterexample.jurisdictionId)?.rank ?? null,
        growthVolatility5Year: profilesByWindow.get(5)?.get(counterexample.jurisdictionId)?.growthVolatility ?? null,
        growthVolatility10Year: profilesByWindow.get(10)?.get(counterexample.jurisdictionId)?.growthVolatility ?? null,
      })),
    resolution: {
      publicPresentation: "source_native_separate_indicators" as const,
      compositeStatus: "not_authorized" as const,
      reason: "The release preserves native inflation, unemployment, and GDP-growth observations. The legacy annual benchmark and volatility profiles are diagnostics only; no composite is authorized unless a later, independently reviewed construct passes the registered frozen-data study.",
    },
  };
  return { ...body, resultSha256: sha256(body) };
}
