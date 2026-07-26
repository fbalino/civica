import {
  CONDITIONS_ALIGNMENT_POLICY,
  CONDITIONS_COMPONENTS,
  CONDITIONS_DIMENSIONS,
  CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  conditionCalculationErrors,
  conditionCalculationKey,
  type ConditionScoreInput,
  type ConditionsComponentId,
  type ConditionsDimension,
} from "./contract";
import {
  CONDITIONS_MISSINGNESS_POLICY,
  conditionsReferencePopulationSha256,
  conditionsReleaseErrors,
  conditionsReleaseManifestSha256,
  type ConditionsDirection,
  type ConditionsNormalizationParameter,
  type ConditionsReferenceSet,
  type ConditionsReleaseInput,
} from "./release";

export const CONDITIONS_RELEASE_VALIDATION_CONTRACT =
  "conditions-release-validation/v1" as const;

export const CONDITIONS_RELEASE_VALIDATION_LIMITS = {
  calculations: 5_000,
  components: 20_000,
  scores: 5_000,
  referenceSets: 100,
  normalizationParameters: 500,
  errors: 50,
} as const;

export const CONDITIONS_RELEASE_RETAINED_TABLES = [
  "civica_conditions_releases",
  "civica_conditions_reference_sets",
  "civica_conditions_normalization_parameters",
  "civica_conditions_calculations",
  "civica_conditions_components",
  "civica_conditions_scores",
] as const;

export interface StoredConditionsRelease {
  releaseId: string;
  methodologyVersion: string;
  manifestSha256: string;
  createdAt: string;
  observedAt: string;
}

export interface StoredConditionsCalculation {
  calculationKey: string;
  releaseId: string | null;
  jurisdictionId: string;
  dimension: string;
  methodologyVersion: string;
  alignmentPolicy: string;
  alignmentStatus: string;
  referenceYear: number | null;
}

export interface StoredConditionsComponent {
  calculationKey: string;
  componentId: string;
  nativeValue: number | null;
  nativeUnit: string;
  referenceYear: number | null;
  valueStatus: string;
  valueStatusReason: string | null;
  inclusionDecision: string;
  sourceId: string;
  indicatorId: string;
  upstreamRelease: string;
  artifactHash: string;
  artifactKind: string;
  temporalCoverage: string;
  licenseUrl: string;
  transformationId: string;
  substitutionReason: string | null;
  methodVersion: string;
}

export interface StoredConditionsScore {
  calculationKey: string | null;
  releaseId: string | null;
  jurisdictionId: string;
  dimension: string;
  quarter: string;
  normalizedScore: number;
  rawValue: number | null;
  sourceId: string;
  indicatorId: string;
  upstreamRelease: string;
  artifactHash: string;
  artifactKind: string;
  temporalCoverage: string;
  licenseUrl: string;
  transformationId: string;
  substitutionReason: string | null;
  methodVersion: string;
  datasetYear: number;
  methodologyVersion: string;
}

export interface StoredConditionsReferenceSet {
  releaseId: string;
  dimension: string;
  referencePeriod: string;
  jurisdictionIds: unknown;
  populationSha256: string;
  candidateCount: number;
  alignedCount: number;
  mixedYearRefusedCount: number;
  missingComponentCount: number;
  includedComponents: unknown;
  missingnessPolicy: string;
}

export interface StoredConditionsNormalizationParameter {
  releaseId: string;
  dimension: string;
  referencePeriod: string;
  componentId: string;
  direction: string;
  transformationId: string;
  mean: number | null;
  standardDeviation: number | null;
  lowerBound: number | null;
  upperBound: number | null;
}

export interface StoredConditionsSourceFreshness {
  sourceId: string;
  lastSyncAt: string | null;
  matchesReleaseCreatedAt: boolean;
}

export interface StoredConditionsRetentionTrigger {
  entityTable: string;
  definition: string;
  enabled: string;
  functionDefinition: string;
}

export interface StoredConditionsMutationCount {
  entityTable: string;
  rows: number;
}

export interface ConditionsReleaseValidationSnapshot {
  release: StoredConditionsRelease | null;
  calculations: StoredConditionsCalculation[];
  components: StoredConditionsComponent[];
  scores: StoredConditionsScore[];
  referenceSets: StoredConditionsReferenceSet[];
  normalizationParameters: StoredConditionsNormalizationParameter[];
  sourceFreshness: StoredConditionsSourceFreshness[];
  retentionTriggers: StoredConditionsRetentionTrigger[];
  mutationCounts: StoredConditionsMutationCount[];
}

export interface ConditionsReleaseDimensionSummary {
  dimension: ConditionsDimension;
  calculations: number;
  aligned: number;
  mixedYearRefused: number;
  missingComponent: number;
  components: number;
  scores: number;
  referenceSets: number;
  normalizationParameters: number;
}

export interface ConditionsReleaseValidationExpectations {
  releaseManifestSha256: string;
  expectedCalculationCounts: Readonly<Record<ConditionsDimension, number>>;
}

export interface ConditionsReleaseValidationReport {
  contract: typeof CONDITIONS_RELEASE_VALIDATION_CONTRACT;
  status: "pass" | "fail";
  releaseId: string;
  methodologyVersion: string | null;
  manifestSha256: string | null;
  manifestReplaySha256: string | null;
  counts: {
    calculations: number;
    components: number;
    scores: number;
    referenceSets: number;
    normalizationParameters: number;
    sources: number;
    retainedTablesWithTriggers: number;
    mutationHistoryRows: number;
  };
  dimensions: ConditionsReleaseDimensionSummary[];
  externalExpectations: {
    releaseManifestSha256: string | null;
    expectedCalculationCounts: Record<ConditionsDimension, number> | null;
    storedManifestMatched: boolean;
    replayManifestMatched: boolean;
    calculationCountsMatched: boolean;
  };
  sourceFreshness: {
    policy: "immediate-post-release-exact-created-at/v1";
    globalMutableStateLimitation: string;
    requiredLastSyncAt: string | null;
    neverSynced: number;
    exactReleaseTimestampMatches: number;
    releaseTimestampMismatches: number;
    earliestLastSyncAt: string | null;
    latestLastSyncAt: string | null;
    allExactlyAtRelease: boolean;
    allAtOrBeforeValidation: boolean;
  };
  replay: {
    calculationKeysReplayed: number;
    calculationKeysMatched: number;
    manifestMatched: boolean;
    retainedTablesCovered: boolean;
    mutationHistoryEmpty: boolean;
  };
  errorCount: number;
  errorsTruncated: boolean;
  errors: string[];
}

const EXPECTED_PARAMETER_CONTRACT: Record<
  ConditionsComponentId,
  {
    direction: ConditionsDirection;
    transformationId: string;
    lowerBound: number | null;
    upperBound: number | null;
  }
> = {
  hdi: {
    direction: "higher_is_better",
    transformationId: "conditions-hdi-fixed-bound/v2",
    lowerBound: 0,
    upperBound: 1,
  },
  global_peace_index: {
    direction: "lower_is_better",
    transformationId: "conditions-gpi-fixed-bound/v2",
    lowerBound: 1,
    upperBound: 5,
  },
  inflation: {
    direction: "not_ranked",
    transformationId: "conditions-economic-source-native/v1",
    lowerBound: null,
    upperBound: null,
  },
  unemployment: {
    direction: "not_ranked",
    transformationId: "conditions-economic-source-native/v1",
    lowerBound: null,
    upperBound: null,
  },
  gdp_growth: {
    direction: "not_ranked",
    transformationId: "conditions-economic-source-native/v1",
    lowerBound: null,
    upperBound: null,
  },
};

const EXPECTED_COMPONENT_CONTRACT: Record<
  ConditionsComponentId,
  {
    sourceId: string;
    /** Null when the adapter deliberately retains the source-row identifier. */
    indicatorIds: readonly string[] | null;
    nativeUnit: string;
    transformationId: string;
  }
> = {
  hdi: {
    sourceId: "undp_hdi",
    indicatorIds: null,
    nativeUnit: "index_0_1",
    transformationId: "conditions-hdi-component/v2",
  },
  global_peace_index: {
    sourceId: "global_peace_index",
    indicatorIds: null,
    nativeUnit: "index_1_5_inverted",
    transformationId: "conditions-gpi-component/v2",
  },
  inflation: {
    sourceId: "worldbank_economic",
    indicatorIds: ["FP.CPI.TOTL.ZG"],
    nativeUnit: "percent_annual_change",
    transformationId: "conditions-economic-component/v1",
  },
  unemployment: {
    sourceId: "worldbank_economic",
    indicatorIds: ["SL.UEM.TOTL.ZS"],
    nativeUnit: "percent_labor_force",
    transformationId: "conditions-economic-component/v1",
  },
  gdp_growth: {
    sourceId: "worldbank_economic",
    indicatorIds: ["NY.GDP.MKTP.KD.ZG"],
    nativeUnit: "percent_annual_change",
    transformationId: "conditions-economic-component/v1",
  },
};

function isDimension(value: string): value is ConditionsDimension {
  return CONDITIONS_DIMENSIONS.includes(value as ConditionsDimension);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export function conditionsReleaseValidationExpectationErrors(
  input: ConditionsReleaseValidationExpectations | null | undefined,
): string[] {
  if (!input || typeof input !== "object") {
    return ["external release expectations are required"];
  }

  const errors: string[] = [];
  if (!/^[a-f0-9]{64}$/.test(input.releaseManifestSha256)) {
    errors.push("external expected manifest SHA-256 is invalid");
  }

  const counts = input.expectedCalculationCounts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    errors.push("external expected calculation counts are required");
    return errors;
  }
  if (!sameStrings(Object.keys(counts), CONDITIONS_DIMENSIONS)) {
    errors.push(
      "external expected calculation counts must cover exactly all Conditions dimensions",
    );
  }
  let total = 0;
  for (const dimension of CONDITIONS_DIMENSIONS) {
    const count = counts[dimension];
    if (
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > CONDITIONS_RELEASE_VALIDATION_LIMITS.calculations
    ) {
      errors.push(
        `${dimension} external expected calculation count is invalid`,
      );
      continue;
    }
    total += count;
  }
  if (total > CONDITIONS_RELEASE_VALIDATION_LIMITS.calculations) {
    errors.push("external expected calculation counts exceed the validation limit");
  }
  return errors;
}

function finiteOrNull(value: number | null): boolean {
  return value === null || Number.isFinite(value);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.0001;
}

function validInstant(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

function boundedPush(errors: string[], message: string): void {
  if (errors.length <= CONDITIONS_RELEASE_VALIDATION_LIMITS.errors) {
    errors.push(message);
  }
}

function expectedComponents(dimension: ConditionsDimension): string[] {
  return [...CONDITIONS_COMPONENTS[dimension]];
}

function referenceKey(
  dimension: string,
  referencePeriod: string,
): string {
  return `${dimension}:${referencePeriod}`;
}

function calculationLabel(
  calculation: StoredConditionsCalculation,
  index: number,
): string {
  return `${calculation.dimension} calculation ${index + 1}`;
}

function retentionTriggerContractIsValid(
  trigger: StoredConditionsRetentionTrigger,
): boolean {
  return (
    ["O", "A"].includes(trigger.enabled) &&
    /BEFORE (?:DELETE OR UPDATE|UPDATE OR DELETE)/i.test(trigger.definition) &&
    /FOR EACH ROW/i.test(trigger.definition) &&
    /civica_capture_research_evidence_history/i.test(trigger.definition) &&
    /RETURNS trigger/i.test(trigger.functionDefinition) &&
    /LANGUAGE plpgsql/i.test(trigger.functionDefinition) &&
    /to_jsonb\(OLD\)/i.test(trigger.functionDefinition) &&
    /to_jsonb\(NEW\)/i.test(trigger.functionDefinition) &&
    /INSERT INTO (?:public\.)?research_evidence_history/i.test(
      trigger.functionDefinition,
    ) &&
    /TG_TABLE_NAME/i.test(trigger.functionDefinition) &&
    /lower\(TG_OP\)/i.test(trigger.functionDefinition) &&
    /IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;/i.test(
      trigger.functionDefinition,
    ) &&
    /RETURN NEW;/i.test(trigger.functionDefinition)
  );
}

function validRetentionTableCount(
  triggers: readonly StoredConditionsRetentionTrigger[],
): number {
  const counts = new Map<string, number>();
  for (const trigger of triggers) {
    if (
      CONDITIONS_RELEASE_RETAINED_TABLES.includes(
        trigger.entityTable as (typeof CONDITIONS_RELEASE_RETAINED_TABLES)[number],
      ) &&
      retentionTriggerContractIsValid(trigger)
    ) {
      counts.set(trigger.entityTable, (counts.get(trigger.entityTable) ?? 0) + 1);
    }
  }
  return CONDITIONS_RELEASE_RETAINED_TABLES.filter(
    (table) => counts.get(table) === 1,
  ).length;
}

function buildReport(input: {
  requestedReleaseId: string;
  snapshot: ConditionsReleaseValidationSnapshot;
  expectations: ConditionsReleaseValidationExpectations | null;
  errors: string[];
  manifestReplaySha256: string | null;
  calculationKeysMatched: number;
}): ConditionsReleaseValidationReport {
  const { requestedReleaseId, snapshot } = input;
  const release = snapshot.release;
  const mutationHistoryRows = snapshot.mutationCounts.reduce(
    (sum, row) => sum + row.rows,
    0,
  );
  const sourceTimes = snapshot.sourceFreshness
    .map((row) => row.lastSyncAt)
    .filter(validInstant)
    .sort();
  const observedTime = release ? Date.parse(release.observedAt) : Number.NaN;
  const exactReleaseTimestampMatches = snapshot.sourceFreshness.filter(
    (row) => row.matchesReleaseCreatedAt,
  ).length;
  const allExactlyAtRelease =
    snapshot.sourceFreshness.length > 0 &&
    exactReleaseTimestampMatches === snapshot.sourceFreshness.length;
  const allAtOrBeforeValidation =
    sourceTimes.length === snapshot.sourceFreshness.length &&
    Number.isFinite(observedTime) &&
    sourceTimes.every((value) => Date.parse(value) <= observedTime);
  const retainedTablesWithTriggers = validRetentionTableCount(
    snapshot.retentionTriggers,
  );
  const totalErrors = input.errors.length;
  const visibleErrors = input.errors.slice(
    0,
    CONDITIONS_RELEASE_VALIDATION_LIMITS.errors,
  );
  const dimensions = CONDITIONS_DIMENSIONS.map((dimension) => {
    const calculations = snapshot.calculations.filter(
      (row) => row.dimension === dimension,
    );
    const calculationKeys = new Set(
      calculations.map((row) => row.calculationKey),
    );
    return {
      dimension,
      calculations: calculations.length,
      aligned: calculations.filter((row) => row.alignmentStatus === "aligned")
        .length,
      mixedYearRefused: calculations.filter(
        (row) => row.alignmentStatus === "mixed_year_refused",
      ).length,
      missingComponent: calculations.filter(
        (row) => row.alignmentStatus === "missing_component",
      ).length,
      components: snapshot.components.filter((row) =>
        calculationKeys.has(row.calculationKey),
      ).length,
      scores: snapshot.scores.filter((row) =>
        row.calculationKey ? calculationKeys.has(row.calculationKey) : false,
      ).length,
      referenceSets: snapshot.referenceSets.filter(
        (row) => row.dimension === dimension,
      ).length,
      normalizationParameters:
        snapshot.normalizationParameters.filter(
          (row) => row.dimension === dimension,
        ).length,
    };
  });
  const calculationCountsMatched =
    input.expectations !== null &&
    dimensions.every(
      ({ dimension, calculations }) =>
        calculations ===
        input.expectations!.expectedCalculationCounts[dimension],
    );

  return {
    contract: CONDITIONS_RELEASE_VALIDATION_CONTRACT,
    status: totalErrors === 0 ? "pass" : "fail",
    releaseId: requestedReleaseId,
    methodologyVersion: release?.methodologyVersion ?? null,
    manifestSha256: release?.manifestSha256 ?? null,
    manifestReplaySha256: input.manifestReplaySha256,
    counts: {
      calculations: snapshot.calculations.length,
      components: snapshot.components.length,
      scores: snapshot.scores.length,
      referenceSets: snapshot.referenceSets.length,
      normalizationParameters: snapshot.normalizationParameters.length,
      sources: snapshot.sourceFreshness.length,
      retainedTablesWithTriggers,
      mutationHistoryRows,
    },
    dimensions,
    externalExpectations: {
      releaseManifestSha256:
        input.expectations?.releaseManifestSha256 ?? null,
      expectedCalculationCounts: input.expectations
        ? { ...input.expectations.expectedCalculationCounts }
        : null,
      storedManifestMatched:
        release !== null &&
        input.expectations !== null &&
        release.manifestSha256 === input.expectations.releaseManifestSha256,
      replayManifestMatched:
        input.expectations !== null &&
        input.manifestReplaySha256 ===
          input.expectations.releaseManifestSha256,
      calculationCountsMatched,
    },
    sourceFreshness: {
      policy: "immediate-post-release-exact-created-at/v1",
      globalMutableStateLimitation:
        "sources.last_sync_at is global mutable state; this gate is valid only immediately after release creation",
      requiredLastSyncAt: release?.createdAt ?? null,
      neverSynced:
        snapshot.sourceFreshness.length - sourceTimes.length,
      exactReleaseTimestampMatches,
      releaseTimestampMismatches:
        snapshot.sourceFreshness.length - exactReleaseTimestampMatches,
      earliestLastSyncAt: sourceTimes.at(0) ?? null,
      latestLastSyncAt: sourceTimes.at(-1) ?? null,
      allExactlyAtRelease,
      allAtOrBeforeValidation,
    },
    replay: {
      calculationKeysReplayed: snapshot.calculations.length,
      calculationKeysMatched: input.calculationKeysMatched,
      manifestMatched:
        release !== null &&
        input.manifestReplaySha256 === release.manifestSha256,
      retainedTablesCovered:
        retainedTablesWithTriggers ===
        CONDITIONS_RELEASE_RETAINED_TABLES.length,
      mutationHistoryEmpty: mutationHistoryRows === 0,
    },
    errorCount: totalErrors,
    errorsTruncated: totalErrors > visibleErrors.length,
    errors: visibleErrors,
  };
}

export function validateConditionsReleaseSnapshot(
  requestedReleaseId: string,
  expectations: ConditionsReleaseValidationExpectations | null | undefined,
  snapshot: ConditionsReleaseValidationSnapshot,
): ConditionsReleaseValidationReport {
  const errors: string[] = [];
  const expectationErrors =
    conditionsReleaseValidationExpectationErrors(expectations);
  for (const error of expectationErrors) boundedPush(errors, error);
  const validExpectations =
    expectationErrors.length === 0 ? expectations! : null;
  const release = snapshot.release;
  let manifestReplaySha256: string | null = null;
  let calculationKeysMatched = 0;

  if (!/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(requestedReleaseId)) {
    boundedPush(errors, "requested release ID is invalid");
  }
  if (!release) {
    boundedPush(errors, "release does not exist");
    return buildReport({
      requestedReleaseId,
      snapshot,
      expectations: validExpectations,
      errors,
      manifestReplaySha256,
      calculationKeysMatched,
    });
  }
  if (release.releaseId !== requestedReleaseId) {
    boundedPush(errors, "stored release ID does not match the requested release");
  }
  if (
    release.methodologyVersion !== CURRENT_CONDITIONS_METHODOLOGY_VERSION
  ) {
    boundedPush(errors, "release methodology version is not the current Conditions contract");
  }
  if (!/^[a-f0-9]{64}$/.test(release.manifestSha256)) {
    boundedPush(errors, "stored manifest hash is invalid");
  }
  if (
    validExpectations &&
    release.manifestSha256 !== validExpectations.releaseManifestSha256
  ) {
    boundedPush(
      errors,
      "stored manifest hash does not match the external expected manifest hash",
    );
  }
  if (!validInstant(release.createdAt) || !validInstant(release.observedAt)) {
    boundedPush(errors, "release or validation timestamp is invalid");
  } else if (Date.parse(release.createdAt) > Date.parse(release.observedAt)) {
    boundedPush(errors, "release timestamp is later than the validation snapshot");
  }

  for (const [name, limit] of Object.entries(
    CONDITIONS_RELEASE_VALIDATION_LIMITS,
  )) {
    if (name === "errors") continue;
    const rows = snapshot[
      name as keyof Pick<
        ConditionsReleaseValidationSnapshot,
        | "calculations"
        | "components"
        | "scores"
        | "referenceSets"
        | "normalizationParameters"
      >
    ];
    if (rows.length > limit) {
      boundedPush(errors, `${name} exceed the bounded validation limit`);
    }
  }

  const calculationsByKey = new Map<string, StoredConditionsCalculation>();
  const jurisdictionDimensionKeys = new Set<string>();
  for (const [index, calculation] of snapshot.calculations.entries()) {
    const label = calculationLabel(calculation, index);
    if (calculationsByKey.has(calculation.calculationKey)) {
      boundedPush(errors, `${label} duplicates a calculation key`);
    }
    calculationsByKey.set(calculation.calculationKey, calculation);
    const jurisdictionDimension = `${calculation.jurisdictionId}:${calculation.dimension}`;
    if (jurisdictionDimensionKeys.has(jurisdictionDimension)) {
      boundedPush(errors, `${label} duplicates a jurisdiction and dimension`);
    }
    jurisdictionDimensionKeys.add(jurisdictionDimension);
    if (calculation.releaseId !== requestedReleaseId) {
      boundedPush(errors, `${label} belongs to another release`);
    }
    if (!isDimension(calculation.dimension)) {
      boundedPush(errors, `${label} has an unknown dimension`);
    }
    if (calculation.methodologyVersion !== release.methodologyVersion) {
      boundedPush(errors, `${label} has a mismatched methodology version`);
    }
    if (calculation.alignmentPolicy !== CONDITIONS_ALIGNMENT_POLICY) {
      boundedPush(errors, `${label} has a mismatched alignment policy`);
    }
  }
  if (snapshot.calculations.length === 0) {
    boundedPush(errors, "release has no calculations");
  }
  for (const dimension of CONDITIONS_DIMENSIONS) {
    const storedCount = snapshot.calculations.filter(
      (row) => row.dimension === dimension,
    ).length;
    if (storedCount === 0) {
      boundedPush(errors, `${dimension} has no calculations`);
    }
    if (
      validExpectations &&
      storedCount !== validExpectations.expectedCalculationCounts[dimension]
    ) {
      boundedPush(
        errors,
        `${dimension} stored calculation count ${storedCount} does not match external expected count ${validExpectations.expectedCalculationCounts[dimension]}`,
      );
    }
  }

  const componentsByCalculation = new Map<
    string,
    StoredConditionsComponent[]
  >();
  for (const component of snapshot.components) {
    const group =
      componentsByCalculation.get(component.calculationKey) ?? [];
    group.push(component);
    componentsByCalculation.set(component.calculationKey, group);
    if (!calculationsByKey.has(component.calculationKey)) {
      boundedPush(errors, "component is orphaned from the requested release");
    }
  }

  const scoresByCalculation = new Map<string, StoredConditionsScore[]>();
  for (const score of snapshot.scores) {
    if (!score.calculationKey) {
      boundedPush(errors, "score has no calculation key");
      continue;
    }
    const group = scoresByCalculation.get(score.calculationKey) ?? [];
    group.push(score);
    scoresByCalculation.set(score.calculationKey, group);
    if (!calculationsByKey.has(score.calculationKey)) {
      boundedPush(errors, "score is orphaned from the requested release");
    }
    if (score.releaseId !== requestedReleaseId) {
      boundedPush(errors, "score belongs to another release");
    }
  }

  for (const [index, calculation] of snapshot.calculations.entries()) {
    if (!isDimension(calculation.dimension)) continue;
    const label = calculationLabel(calculation, index);
    const components =
      componentsByCalculation.get(calculation.calculationKey) ?? [];
    const scores = scoresByCalculation.get(calculation.calculationKey) ?? [];
    const requiredComponents = expectedComponents(calculation.dimension);
    if (
      !sameStrings(
        components.map((component) => component.componentId),
        requiredComponents,
      )
    ) {
      boundedPush(errors, `${label} does not store exactly its required components`);
    }
    if (
      new Set(components.map((component) => component.componentId)).size !==
      components.length
    ) {
      boundedPush(errors, `${label} has duplicate components`);
    }
    for (const storedComponent of components) {
      const expected =
        EXPECTED_COMPONENT_CONTRACT[
          storedComponent.componentId as ConditionsComponentId
        ];
      if (
        !expected ||
        storedComponent.sourceId !== expected.sourceId ||
        (expected.indicatorIds !== null &&
          !expected.indicatorIds.includes(storedComponent.indicatorId)) ||
        storedComponent.nativeUnit !== expected.nativeUnit ||
        storedComponent.transformationId !== expected.transformationId ||
        storedComponent.methodVersion !== release.methodologyVersion
      ) {
        boundedPush(errors, `${label} component contract does not match the methodology`);
      }
    }

    const score = scores.length === 1 ? scores[0] : null;
    const shouldHaveScore =
      calculation.alignmentStatus === "aligned" &&
      calculation.dimension !== "economic_stability";
    if (shouldHaveScore && scores.length !== 1) {
      boundedPush(errors, `${label} must have exactly one score`);
    }
    if (!shouldHaveScore && scores.length !== 0) {
      boundedPush(errors, `${label} must not have a score`);
    }
    if (scores.length > 1) {
      boundedPush(errors, `${label} has multiple score rows`);
    }
    if (score) {
      if (
        score.jurisdictionId !== calculation.jurisdictionId ||
        score.dimension !== calculation.dimension ||
        score.methodologyVersion !== calculation.methodologyVersion
      ) {
        boundedPush(errors, `${label} score identity does not match its calculation`);
      }
      if (
        calculation.referenceYear === null ||
        score.datasetYear !== calculation.referenceYear ||
        score.quarter !== `${calculation.referenceYear}-Q4`
      ) {
        boundedPush(errors, `${label} score period does not match its calculation`);
      }
      if (
        !Number.isFinite(score.normalizedScore) ||
        score.normalizedScore < 0 ||
        score.normalizedScore > 100 ||
        !Number.isFinite(score.rawValue)
      ) {
        boundedPush(errors, `${label} score values are invalid`);
      }
      if (
        !score.sourceId.trim() ||
        !score.indicatorId.trim() ||
        !score.upstreamRelease.trim() ||
        !/^[a-f0-9]{64}$/.test(score.artifactHash) ||
        !["publisher_bytes", "normalized_batch"].includes(score.artifactKind) ||
        !score.temporalCoverage.trim() ||
        !/^https:\/\//.test(score.licenseUrl) ||
        !score.transformationId.trim() ||
        !score.methodVersion.trim()
      ) {
        boundedPush(errors, `${label} score lineage is incomplete`);
      }
      if (
        components.length === 1 &&
        (score.sourceId !== components[0].sourceId ||
          score.indicatorId !== components[0].indicatorId ||
          score.rawValue !== components[0].nativeValue ||
          score.upstreamRelease !== components[0].upstreamRelease ||
          score.artifactHash !== components[0].artifactHash ||
          score.artifactKind !== components[0].artifactKind ||
          score.temporalCoverage !== components[0].temporalCoverage ||
          score.licenseUrl !== components[0].licenseUrl ||
          score.substitutionReason !== components[0].substitutionReason ||
          score.methodVersion !== components[0].methodVersion)
      ) {
        boundedPush(errors, `${label} score does not match its stored source component`);
      }
      if (
        components.length === 1 &&
        score.transformationId !==
          EXPECTED_PARAMETER_CONTRACT[
            components[0].componentId as ConditionsComponentId
          ]?.transformationId
      ) {
        boundedPush(errors, `${label} score transformation does not match its frozen parameter`);
      }
      if (score.rawValue !== null) {
        const expectedScore =
          calculation.dimension === "human_development"
            ? Math.min(100, Math.max(0, score.rawValue * 100))
            : calculation.dimension === "peace_security"
              ? Math.min(100, Math.max(0, ((5 - score.rawValue) / 4) * 100))
              : null;
        if (
          expectedScore === null ||
          !nearlyEqual(score.normalizedScore, expectedScore)
        ) {
          boundedPush(errors, `${label} normalized score does not replay`);
        }
        if (
          (calculation.dimension === "human_development" &&
            (score.rawValue < 0 || score.rawValue > 1)) ||
          (calculation.dimension === "peace_security" &&
            (score.rawValue < 1 || score.rawValue > 5))
        ) {
          boundedPush(errors, `${label} raw value is outside its declared bounds`);
        }
      }
    }

    const calculationInput = {
      calculationKey: calculation.calculationKey,
      releaseId: requestedReleaseId,
      jurisdictionId: calculation.jurisdictionId,
      dimension: calculation.dimension,
      quarter: score?.quarter ?? (
        calculation.dimension === "economic_stability" &&
        calculation.alignmentStatus === "aligned" &&
        calculation.referenceYear !== null
          ? `${calculation.referenceYear}-Q4`
          : null
      ),
      normalizedScore: score?.normalizedScore ?? null,
      rawValue: score?.rawValue ?? null,
      sourceId: score?.sourceId ?? components[0]?.sourceId ?? "",
      datasetYear: score?.datasetYear ?? (
        calculation.dimension === "economic_stability" &&
        calculation.alignmentStatus === "aligned"
          ? calculation.referenceYear
          : null
      ),
      methodologyVersion: calculation.methodologyVersion,
      referenceYear: calculation.referenceYear,
      alignmentPolicy: calculation.alignmentPolicy,
      alignmentStatus: calculation.alignmentStatus,
      components,
      indicatorId: score?.indicatorId ?? components[0]?.indicatorId ?? "",
      upstreamRelease:
        score?.upstreamRelease ?? components[0]?.upstreamRelease ?? "",
      artifactHash: score?.artifactHash ?? components[0]?.artifactHash ?? "",
      artifactKind:
        score?.artifactKind ?? components[0]?.artifactKind ?? "publisher_bytes",
      temporalCoverage:
        score?.temporalCoverage ?? components[0]?.temporalCoverage ?? "",
      licenseUrl: score?.licenseUrl ?? components[0]?.licenseUrl ?? "",
      transformationId:
        score?.transformationId ?? components[0]?.transformationId ?? "",
      substitutionReason:
        score?.substitutionReason ?? components[0]?.substitutionReason ?? null,
      methodVersion:
        score?.methodVersion ?? components[0]?.methodVersion ?? "",
    } as ConditionScoreInput;

    let calculationErrors: string[] = [];
    try {
      calculationErrors = conditionCalculationErrors(calculationInput);
    } catch {
      calculationErrors = ["calculation could not be evaluated"];
    }
    for (const error of calculationErrors) {
      boundedPush(errors, `${label}: ${error}`);
    }
    try {
      if (
        conditionCalculationKey(calculationInput) ===
        calculation.calculationKey
      ) {
        calculationKeysMatched += 1;
      } else {
        boundedPush(errors, `${label} calculation key does not replay`);
      }
    } catch {
      boundedPush(errors, `${label} calculation key could not be replayed`);
    }
  }

  const parametersByReference = new Map<
    string,
    StoredConditionsNormalizationParameter[]
  >();
  for (const parameter of snapshot.normalizationParameters) {
    const key = referenceKey(parameter.dimension, parameter.referencePeriod);
    const group = parametersByReference.get(key) ?? [];
    group.push(parameter);
    parametersByReference.set(key, group);
    if (parameter.releaseId !== requestedReleaseId) {
      boundedPush(errors, "normalization parameter belongs to another release");
    }
  }

  const referenceKeys = new Set<string>();
  const canonicalReferenceSets: ConditionsReferenceSet[] = [];
  for (const referenceSet of snapshot.referenceSets) {
    const key = referenceKey(
      referenceSet.dimension,
      referenceSet.referencePeriod,
    );
    if (referenceKeys.has(key)) {
      boundedPush(errors, `${key} duplicates a reference set`);
    }
    referenceKeys.add(key);
    if (referenceSet.releaseId !== requestedReleaseId) {
      boundedPush(errors, `${key} belongs to another release`);
    }
    if (!isDimension(referenceSet.dimension)) {
      boundedPush(errors, `${key} has an unknown dimension`);
      continue;
    }
    if (!isStringArray(referenceSet.jurisdictionIds)) {
      boundedPush(errors, `${key} has an invalid reference population`);
      continue;
    }
    if (!isStringArray(referenceSet.includedComponents)) {
      boundedPush(errors, `${key} has invalid included components`);
      continue;
    }
    if (
      referenceSet.populationSha256 !==
      conditionsReferencePopulationSha256(referenceSet.jurisdictionIds)
    ) {
      boundedPush(errors, `${key} population hash does not replay`);
    }
    const requiredComponents = expectedComponents(referenceSet.dimension);
    if (
      !sameStrings(referenceSet.includedComponents, requiredComponents)
    ) {
      boundedPush(errors, `${key} does not declare exactly the required components`);
    }
    if (referenceSet.missingnessPolicy !== CONDITIONS_MISSINGNESS_POLICY) {
      boundedPush(errors, `${key} has a mismatched missingness policy`);
    }

    const dimensionCalculations = snapshot.calculations.filter(
      (row) => row.dimension === referenceSet.dimension,
    );
    const expectedPopulation = dimensionCalculations
      .filter(
        (row) =>
          row.alignmentStatus === "aligned" &&
          row.referenceYear !== null &&
          `${row.referenceYear}-Q4` === referenceSet.referencePeriod,
      )
      .map((row) => row.jurisdictionId);
    const mixedYearRefusedCount = dimensionCalculations.filter(
      (row) => row.alignmentStatus === "mixed_year_refused",
    ).length;
    const missingComponentCount = dimensionCalculations.filter(
      (row) => row.alignmentStatus === "missing_component",
    ).length;
    if (
      referenceSet.candidateCount !== dimensionCalculations.length ||
      referenceSet.alignedCount !== expectedPopulation.length ||
      referenceSet.mixedYearRefusedCount !== mixedYearRefusedCount ||
      referenceSet.missingComponentCount !== missingComponentCount
    ) {
      boundedPush(errors, `${key} cardinality does not match stored calculations`);
    }
    if (!sameStrings(referenceSet.jurisdictionIds, expectedPopulation)) {
      boundedPush(errors, `${key} population does not match aligned calculations`);
    }

    const storedParameters = parametersByReference.get(key) ?? [];
    if (
      !sameStrings(
        storedParameters.map((parameter) => parameter.componentId),
        requiredComponents,
      ) ||
      new Set(storedParameters.map((parameter) => parameter.componentId))
        .size !== storedParameters.length
    ) {
      boundedPush(errors, `${key} does not store exactly one parameter per component`);
    }
    const canonicalParameters: ConditionsNormalizationParameter[] = [];
    for (const parameter of storedParameters) {
      const expected =
        EXPECTED_PARAMETER_CONTRACT[
          parameter.componentId as ConditionsComponentId
        ];
      if (!expected) {
        boundedPush(errors, `${key} has an unknown parameter component`);
        continue;
      }
      if (
        parameter.direction !== expected.direction ||
        parameter.transformationId !== expected.transformationId ||
        parameter.mean !== null ||
        parameter.standardDeviation !== null ||
        parameter.lowerBound !== expected.lowerBound ||
        parameter.upperBound !== expected.upperBound
      ) {
        boundedPush(errors, `${key} parameter contract does not match the methodology`);
      }
      if (
        !finiteOrNull(parameter.mean) ||
        !finiteOrNull(parameter.standardDeviation) ||
        !finiteOrNull(parameter.lowerBound) ||
        !finiteOrNull(parameter.upperBound)
      ) {
        boundedPush(errors, `${key} has a non-finite parameter`);
      }
      if (
        expected.direction === "not_ranked" &&
        (parameter.mean !== null ||
          parameter.standardDeviation !== null ||
          parameter.lowerBound !== null ||
          parameter.upperBound !== null)
      ) {
        boundedPush(errors, `${key} source-native parameter must not rank or normalize`);
      }
      canonicalParameters.push({
        componentId: parameter.componentId as ConditionsComponentId,
        direction: parameter.direction as ConditionsDirection,
        transformationId: parameter.transformationId,
        mean: parameter.mean,
        standardDeviation: parameter.standardDeviation,
        lowerBound: parameter.lowerBound,
        upperBound: parameter.upperBound,
      });
    }
    canonicalReferenceSets.push({
      dimension: referenceSet.dimension,
      referencePeriod: referenceSet.referencePeriod,
      jurisdictionIds: referenceSet.jurisdictionIds,
      candidateCount: referenceSet.candidateCount,
      alignedCount: referenceSet.alignedCount,
      mixedYearRefusedCount: referenceSet.mixedYearRefusedCount,
      missingComponentCount: referenceSet.missingComponentCount,
      includedComponents:
        referenceSet.includedComponents as ConditionsComponentId[],
      missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
      parameters: canonicalParameters,
    });
  }

  const expectedReferenceKeys = new Set(
    snapshot.calculations
      .filter(
        (row) =>
          isDimension(row.dimension) &&
          row.alignmentStatus === "aligned" &&
          row.referenceYear !== null,
      )
      .map((row) => `${row.dimension}:${row.referenceYear}-Q4`),
  );
  if (!sameStrings([...referenceKeys], [...expectedReferenceKeys])) {
    boundedPush(errors, "reference sets do not exactly cover aligned calculation periods");
  }
  for (const dimension of CONDITIONS_DIMENSIONS) {
    if (!snapshot.referenceSets.some((row) => row.dimension === dimension)) {
      boundedPush(errors, `${dimension} has no reference set`);
    }
  }
  for (const key of parametersByReference.keys()) {
    if (!referenceKeys.has(key)) {
      boundedPush(errors, `${key} has parameters without a reference set`);
    }
  }

  const releaseInput: ConditionsReleaseInput = {
    releaseId: requestedReleaseId,
    methodologyVersion: release.methodologyVersion,
    referenceSets: canonicalReferenceSets,
  };
  const skeletalCalculations = snapshot.calculations.map(
    ({ calculationKey }) =>
      ({
        calculationKey,
        releaseId: requestedReleaseId,
        methodologyVersion: release.methodologyVersion,
      }) as ConditionScoreInput,
  );
  for (const error of conditionsReleaseErrors(
    releaseInput,
    skeletalCalculations,
  )) {
    boundedPush(errors, `release: ${error}`);
  }
  try {
    manifestReplaySha256 = conditionsReleaseManifestSha256(
      releaseInput,
      skeletalCalculations,
    );
    if (manifestReplaySha256 !== release.manifestSha256) {
      boundedPush(errors, "release manifest hash does not replay");
    }
    if (
      validExpectations &&
      manifestReplaySha256 !== validExpectations.releaseManifestSha256
    ) {
      boundedPush(
        errors,
        "replayed manifest hash does not match the external expected manifest hash",
      );
    }
  } catch {
    boundedPush(errors, "release manifest could not be replayed");
  }

  const componentSourceIds = new Set(
    snapshot.components.map((component) => component.sourceId),
  );
  const freshnessSourceIds = snapshot.sourceFreshness.map(
    (source) => source.sourceId,
  );
  if (
    !sameStrings([...componentSourceIds], freshnessSourceIds) ||
    new Set(freshnessSourceIds).size !== freshnessSourceIds.length
  ) {
    boundedPush(errors, "source freshness rows do not exactly cover component sources");
  }
  const observedTime = Date.parse(release.observedAt);
  for (const source of snapshot.sourceFreshness) {
    if (!validInstant(source.lastSyncAt)) {
      boundedPush(errors, "a component source has never been synced");
      continue;
    }
    const lastSyncAt = Date.parse(source.lastSyncAt);
    if (!source.matchesReleaseCreatedAt) {
      boundedPush(
        errors,
        `${source.sourceId} last_sync_at does not exactly equal release created_at; sources.last_sync_at is global mutable state, so this gate is valid only immediately after release creation`,
      );
    }
    if (Number.isFinite(observedTime) && lastSyncAt > observedTime) {
      boundedPush(errors, "a component source freshness timestamp is in the future");
    }
  }

  const triggerCounts = new Map<string, number>();
  for (const trigger of snapshot.retentionTriggers) {
    if (
      !CONDITIONS_RELEASE_RETAINED_TABLES.includes(
        trigger.entityTable as (typeof CONDITIONS_RELEASE_RETAINED_TABLES)[number],
      )
    ) {
      boundedPush(errors, "unexpected Conditions retention trigger row");
      continue;
    }
    triggerCounts.set(
      trigger.entityTable,
      (triggerCounts.get(trigger.entityTable) ?? 0) + 1,
    );
    if (!["O", "A"].includes(trigger.enabled)) {
      boundedPush(
        errors,
        `${trigger.entityTable} mutation-retention trigger is disabled`,
      );
    }
    if (!retentionTriggerContractIsValid(trigger)) {
      boundedPush(
        errors,
        `${trigger.entityTable} mutation-retention trigger contract is incomplete`,
      );
    }
  }
  for (const table of CONDITIONS_RELEASE_RETAINED_TABLES) {
    const triggerCount = triggerCounts.get(table) ?? 0;
    if (triggerCount === 0) {
      boundedPush(errors, `${table} has no mutation-retention trigger`);
    } else if (triggerCount !== 1) {
      boundedPush(
        errors,
        `${table} must have exactly one mutation-retention trigger`,
      );
    }
  }
  const mutationHistoryRows = snapshot.mutationCounts.reduce((sum, row) => {
    if (
      !CONDITIONS_RELEASE_RETAINED_TABLES.includes(
        row.entityTable as (typeof CONDITIONS_RELEASE_RETAINED_TABLES)[number],
      ) ||
      !Number.isSafeInteger(row.rows) ||
      row.rows < 0
    ) {
      boundedPush(errors, "mutation-history summary is invalid");
      return sum;
    }
    return sum + row.rows;
  }, 0);
  if (mutationHistoryRows !== 0) {
    boundedPush(errors, "immutable release has retained update or delete history");
  }

  return buildReport({
    requestedReleaseId,
    snapshot,
    expectations: validExpectations,
    errors,
    manifestReplaySha256,
    calculationKeysMatched,
  });
}
