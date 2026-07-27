import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CONDITIONS_ALIGNMENT_POLICY,
  CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  conditionCalculationKey,
  type ConditionScoreInput,
  type ConditionsComponentInput,
  type ConditionsDimension,
} from "../contract";
import {
  CONDITIONS_RELEASE_RETAINED_TABLES,
  conditionsReleaseValidationExpectationErrors,
  validateConditionsReleaseSnapshot,
  type ConditionsReleaseValidationExpectations,
  type ConditionsReleaseValidationSnapshot,
  type StoredConditionsScore,
} from "../release-live-validation";
import {
  CONDITIONS_MISSINGNESS_POLICY,
  conditionsReferencePopulationSha256,
  conditionsReleaseManifestSha256,
  type ConditionsReferenceSet,
} from "../release";
import {
  CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT,
  conditionsReleaseExpectationTargetsMatch,
  conditionsReleaseExpectationsArtifactSha256,
  createConditionsReleaseExpectationsArtifact,
  parseConditionsReleaseExpectationsArtifact,
  serializeConditionsReleaseExpectationsArtifact,
} from "../release-expectations";
import { neonHostnameSha256 } from "../../qa/neon-target";

const RELEASE_ID = "conditions-live-validator-fixture-v1";
const JURISDICTION_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = "2026-07-26T12:00:00.000Z";
const OBSERVED_AT = "2026-07-26T12:05:00.000Z";
const SYNCED_AT = "2026-07-26T12:01:00.000Z";
const RETENTION_FUNCTION_DEFINITION = `
CREATE OR REPLACE FUNCTION public.civica_capture_research_evidence_history()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;
BEGIN
  INSERT INTO research_evidence_history (
    entity_table, entity_id, operation, before, after, reason, actor_id
  ) VALUES (
    TG_TABLE_NAME, 'fixture', lower(TG_OP), before_row, after_row, 'fixture', current_user
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
`;

function component(input: {
  componentId:
    | "hdi"
    | "global_peace_index"
    | "inflation"
    | "unemployment"
    | "gdp_growth";
  sourceId: string;
  indicatorId: string;
  nativeValue: number;
  nativeUnit: string;
  transformationId: string;
}): ConditionsComponentInput {
  return {
    ...input,
    referenceYear: 2024,
    valueStatus: "observed",
    valueStatusReason: null,
    inclusionDecision: "included",
    upstreamRelease: "fixture-2024",
    artifactHash: "a".repeat(64),
    artifactKind: "publisher_bytes",
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    substitutionReason: null,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
}

function calculation(input: {
  dimension: ConditionsDimension;
  components: ConditionsComponentInput[];
  normalizedScore: number | null;
  rawValue: number | null;
  sourceId: string;
  indicatorId: string;
  transformationId: string;
}): ConditionScoreInput {
  const base = {
    releaseId: RELEASE_ID,
    jurisdictionId: JURISDICTION_ID,
    dimension: input.dimension,
    quarter: "2024-Q4",
    normalizedScore: input.normalizedScore,
    rawValue: input.rawValue,
    sourceId: input.sourceId,
    datasetYear: 2024,
    methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
    referenceYear: 2024,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: "aligned" as const,
    components: input.components,
    indicatorId: input.indicatorId,
    upstreamRelease: "fixture-2024",
    artifactHash: "a".repeat(64),
    artifactKind: "publisher_bytes" as const,
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    transformationId: input.transformationId,
    substitutionReason: null,
    methodVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

function validRows(): ConditionScoreInput[] {
  return [
    calculation({
      dimension: "human_development",
      components: [
        component({
          componentId: "hdi",
          sourceId: "undp_hdi",
          indicatorId: "hdi",
          nativeValue: 0.9,
          nativeUnit: "index_0_1",
          transformationId: "conditions-hdi-component/v2",
        }),
      ],
      normalizedScore: 90,
      rawValue: 0.9,
      sourceId: "undp_hdi",
      indicatorId: "hdi",
      transformationId: "conditions-hdi-fixed-bound/v2",
    }),
    calculation({
      dimension: "peace_security",
      components: [
        component({
          componentId: "global_peace_index",
          sourceId: "global_peace_index",
          indicatorId: "GPI_SCORE",
          nativeValue: 2,
          nativeUnit: "index_1_5_inverted",
          transformationId: "conditions-gpi-component/v2",
        }),
      ],
      normalizedScore: 75,
      rawValue: 2,
      sourceId: "global_peace_index",
      indicatorId: "GPI_SCORE",
      transformationId: "conditions-gpi-fixed-bound/v2",
    }),
    calculation({
      dimension: "economic_stability",
      components: [
        component({
          componentId: "inflation",
          sourceId: "worldbank_economic",
          indicatorId: "FP.CPI.TOTL.ZG",
          nativeValue: 5,
          nativeUnit: "percent_annual_change",
          transformationId: "conditions-economic-component/v1",
        }),
        component({
          componentId: "unemployment",
          sourceId: "worldbank_economic",
          indicatorId: "SL.UEM.TOTL.ZS",
          nativeValue: 8,
          nativeUnit: "percent_labor_force",
          transformationId: "conditions-economic-component/v1",
        }),
        component({
          componentId: "gdp_growth",
          sourceId: "worldbank_economic",
          indicatorId: "NY.GDP.MKTP.KD.ZG",
          nativeValue: 2,
          nativeUnit: "percent_annual_change",
          transformationId: "conditions-economic-component/v1",
        }),
      ],
      normalizedScore: null,
      rawValue: null,
      sourceId: "worldbank_economic",
      indicatorId:
        "FP.CPI.TOTL.ZG+SL.UEM.TOTL.ZS+NY.GDP.MKTP.KD.ZG",
      transformationId: "conditions-economic-source-native/v1",
    }),
  ];
}

function referenceSets(): ConditionsReferenceSet[] {
  return [
    {
      dimension: "human_development",
      referencePeriod: "2024-Q4",
      jurisdictionIds: [JURISDICTION_ID],
      candidateCount: 1,
      alignedCount: 1,
      mixedYearRefusedCount: 0,
      missingComponentCount: 0,
      includedComponents: ["hdi"],
      missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
      parameters: [
        {
          componentId: "hdi",
          direction: "higher_is_better",
          transformationId: "conditions-hdi-fixed-bound/v2",
          mean: null,
          standardDeviation: null,
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    },
    {
      dimension: "peace_security",
      referencePeriod: "2024-Q4",
      jurisdictionIds: [JURISDICTION_ID],
      candidateCount: 1,
      alignedCount: 1,
      mixedYearRefusedCount: 0,
      missingComponentCount: 0,
      includedComponents: ["global_peace_index"],
      missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
      parameters: [
        {
          componentId: "global_peace_index",
          direction: "lower_is_better",
          transformationId: "conditions-gpi-fixed-bound/v2",
          mean: null,
          standardDeviation: null,
          lowerBound: 1,
          upperBound: 5,
        },
      ],
    },
    {
      dimension: "economic_stability",
      referencePeriod: "2024-Q4",
      jurisdictionIds: [JURISDICTION_ID],
      candidateCount: 1,
      alignedCount: 1,
      mixedYearRefusedCount: 0,
      missingComponentCount: 0,
      includedComponents: ["inflation", "unemployment", "gdp_growth"],
      missingnessPolicy: CONDITIONS_MISSINGNESS_POLICY,
      parameters: ["inflation", "unemployment", "gdp_growth"].map(
        (componentId) => ({
          componentId: componentId as
            | "inflation"
            | "unemployment"
            | "gdp_growth",
          direction: "not_ranked" as const,
          transformationId: "conditions-economic-source-native/v1",
          mean: null,
          standardDeviation: null,
          lowerBound: null,
          upperBound: null,
        }),
      ),
    },
  ];
}

function storedScore(row: ConditionScoreInput): StoredConditionsScore {
  return {
    calculationKey: row.calculationKey,
    releaseId: row.releaseId,
    jurisdictionId: row.jurisdictionId,
    dimension: row.dimension,
    quarter: row.quarter!,
    normalizedScore: row.normalizedScore!,
    rawValue: row.rawValue,
    sourceId: row.sourceId,
    indicatorId: row.indicatorId,
    upstreamRelease: row.upstreamRelease,
    artifactHash: row.artifactHash,
    artifactKind: row.artifactKind,
    temporalCoverage: row.temporalCoverage,
    licenseUrl: row.licenseUrl,
    transformationId: row.transformationId,
    substitutionReason: row.substitutionReason,
    methodVersion: row.methodVersion,
    datasetYear: row.datasetYear!,
    methodologyVersion: row.methodologyVersion,
  };
}

function validSnapshot(): ConditionsReleaseValidationSnapshot {
  const rows = validRows();
  const sets = referenceSets();
  const manifestSha256 = conditionsReleaseManifestSha256(
    {
      releaseId: RELEASE_ID,
      methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
      referenceSets: sets,
    },
    rows,
  );
  return {
    release: {
      releaseId: RELEASE_ID,
      methodologyVersion: CURRENT_CONDITIONS_METHODOLOGY_VERSION,
      manifestSha256,
      createdAt: CREATED_AT,
      observedAt: OBSERVED_AT,
    },
    calculations: rows.map((row) => ({
      calculationKey: row.calculationKey,
      releaseId: row.releaseId,
      jurisdictionId: row.jurisdictionId,
      dimension: row.dimension,
      methodologyVersion: row.methodologyVersion,
      alignmentPolicy: row.alignmentPolicy,
      alignmentStatus: row.alignmentStatus,
      referenceYear: row.referenceYear,
    })),
    components: rows.flatMap((row) =>
      row.components.map((item) => ({
        calculationKey: row.calculationKey,
        ...item,
      })),
    ),
    scores: rows
      .filter((row) => row.normalizedScore !== null)
      .map(storedScore),
    referenceSets: sets.map((set) => ({
      releaseId: RELEASE_ID,
      dimension: set.dimension,
      referencePeriod: set.referencePeriod,
      jurisdictionIds: [...set.jurisdictionIds],
      populationSha256: conditionsReferencePopulationSha256(
        set.jurisdictionIds,
      ),
      candidateCount: set.candidateCount,
      alignedCount: set.alignedCount,
      mixedYearRefusedCount: set.mixedYearRefusedCount,
      missingComponentCount: set.missingComponentCount,
      includedComponents: [...set.includedComponents],
      missingnessPolicy: set.missingnessPolicy,
    })),
    normalizationParameters: sets.flatMap((set) =>
      set.parameters.map((parameter) => ({
        releaseId: RELEASE_ID,
        dimension: set.dimension,
        referencePeriod: set.referencePeriod,
        ...parameter,
      })),
    ),
    sourceFreshness: [
      {
        sourceId: "global_peace_index",
        lastSyncAt: CREATED_AT,
        matchesReleaseCreatedAt: true,
      },
      {
        sourceId: "undp_hdi",
        lastSyncAt: CREATED_AT,
        matchesReleaseCreatedAt: true,
      },
      {
        sourceId: "worldbank_economic",
        lastSyncAt: CREATED_AT,
        matchesReleaseCreatedAt: true,
      },
    ],
    retentionTriggers: CONDITIONS_RELEASE_RETAINED_TABLES.map(
      (entityTable) => ({
        entityTable,
        definition:
          `CREATE TRIGGER dat_016_retain_mutation BEFORE UPDATE OR DELETE ON public.${entityTable} FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history()`,
        enabled: "O",
        functionDefinition: RETENTION_FUNCTION_DEFINITION,
      }),
    ),
    mutationCounts: [],
  };
}

function validExpectations(
  snapshot: ConditionsReleaseValidationSnapshot,
): ConditionsReleaseValidationExpectations {
  return {
    releaseManifestSha256: snapshot.release!.manifestSha256,
    expectedCalculationCounts: {
      human_development: 1,
      peace_security: 1,
      economic_stability: 1,
    },
  };
}

test("Conditions dry-run expectations artifact is closed, deterministic, and target-bound", () => {
  const snapshot = validSnapshot();
  const databaseTarget = {
    projectId: "project-qa",
    branchId: "branch-qa",
    endpointId: "endpoint-qa",
    hostnameSha256: neonHostnameSha256("ep-qa.example.neon.tech"),
    migrationHead: "0048_entity_name_forms",
    ledgerPresent: true,
    writesPerformed: 0 as const,
  };
  const artifact = createConditionsReleaseExpectationsArtifact({
    releaseId: RELEASE_ID,
    ...validExpectations(snapshot),
    databaseTarget,
  });
  const serialized =
    serializeConditionsReleaseExpectationsArtifact(artifact);
  assert.equal(artifact.contract, CONDITIONS_RELEASE_EXPECTATIONS_CONTRACT);
  assert.deepEqual(
    parseConditionsReleaseExpectationsArtifact(serialized),
    artifact,
  );
  assert.match(
    conditionsReleaseExpectationsArtifactSha256(serialized),
    /^[a-f0-9]{64}$/,
  );
  assert.equal(
    conditionsReleaseExpectationTargetsMatch(
      artifact.databaseTarget,
      databaseTarget,
    ),
    true,
  );
  assert.throws(
    () =>
      parseConditionsReleaseExpectationsArtifact(
        serialized.replace(
          `"releaseId": "${RELEASE_ID}"`,
          `"releaseId": "${RELEASE_ID}", "extra": true`,
        ),
      ),
    /open or incomplete shape/,
  );
  assert.throws(
    () =>
      parseConditionsReleaseExpectationsArtifact(
        serialized.replace(
          databaseTarget.branchId,
          "",
        ),
      ),
    /branch ID is required/,
  );
});

test("Conditions release live validator replays a complete immutable release", () => {
  const snapshot = validSnapshot();
  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    validExpectations(snapshot),
    snapshot,
  );
  assert.equal(report.status, "pass", report.errors.join("\n"));
  assert.equal(report.errorCount, 0);
  assert.equal(report.replay.calculationKeysMatched, 3);
  assert.equal(report.replay.manifestMatched, true);
  assert.equal(report.replay.retainedTablesCovered, true);
  assert.equal(report.replay.mutationHistoryEmpty, true);
  assert.equal(report.externalExpectations.calculationCountsMatched, true);
  assert.equal(report.sourceFreshness.allExactlyAtRelease, true);
  assert.deepEqual(
    report.dimensions.map(({ dimension, calculations, scores }) => ({
      dimension,
      calculations,
      scores,
    })),
    [
      { dimension: "human_development", calculations: 1, scores: 1 },
      { dimension: "peace_security", calculations: 1, scores: 1 },
      { dimension: "economic_stability", calculations: 1, scores: 0 },
    ],
  );
  assert.equal("calculations" in (report as unknown as { rows?: unknown }), false);
});

test("Conditions release live validator fails closed on cardinality, replay, and alignment drift", () => {
  const snapshot = validSnapshot();
  const expectations = validExpectations(snapshot);
  snapshot.calculations.push({ ...snapshot.calculations[0] });
  snapshot.scores[0] = {
    ...snapshot.scores[0],
    quarter: "2023-Q4",
  };
  snapshot.referenceSets[0] = {
    ...snapshot.referenceSets[0],
    candidateCount: 99,
  };
  snapshot.release = {
    ...snapshot.release!,
    manifestSha256: "f".repeat(64),
  };
  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    expectations,
    snapshot,
  );
  assert.equal(report.status, "fail");
  assert.match(report.errors.join(" "), /duplicates a jurisdiction and dimension/);
  assert.match(report.errors.join(" "), /score period does not match/);
  assert.match(report.errors.join(" "), /cardinality does not match/);
  assert.equal(report.replay.manifestMatched, false);
});

test("Conditions release live validator requires bounded freshness and immutable retention evidence", () => {
  const snapshot = validSnapshot();
  const expectations = validExpectations(snapshot);
  snapshot.sourceFreshness[0] = {
    ...snapshot.sourceFreshness[0],
    lastSyncAt: null,
    matchesReleaseCreatedAt: false,
  };
  snapshot.retentionTriggers.pop();
  snapshot.mutationCounts.push({
    entityTable: "civica_conditions_scores",
    rows: 1,
  });
  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    expectations,
    snapshot,
  );
  assert.equal(report.status, "fail");
  assert.equal(report.sourceFreshness.neverSynced, 1);
  assert.equal(report.replay.retainedTablesCovered, false);
  assert.equal(report.replay.mutationHistoryEmpty, false);
  assert.match(report.errors.join(" "), /never been synced/);
  assert.match(report.errors.join(" "), /has no mutation-retention trigger/);
  assert.match(report.errors.join(" "), /retained update or delete history/);
});

test("Conditions release live validator rejects disabled, duplicate, or no-op retention machinery", () => {
  const snapshot = validSnapshot();
  const expectations = validExpectations(snapshot);
  snapshot.retentionTriggers[0] = {
    ...snapshot.retentionTriggers[0],
    enabled: "D",
  };
  snapshot.retentionTriggers[1] = {
    ...snapshot.retentionTriggers[1],
    functionDefinition:
      "CREATE FUNCTION civica_capture_research_evidence_history() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END;'",
  };
  snapshot.retentionTriggers.push({ ...snapshot.retentionTriggers[2] });

  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    expectations,
    snapshot,
  );
  assert.equal(report.status, "fail");
  assert.equal(report.replay.retainedTablesCovered, false);
  assert.match(report.errors.join(" "), /trigger is disabled/);
  assert.match(report.errors.join(" "), /trigger contract is incomplete/);
  assert.match(report.errors.join(" "), /exactly one mutation-retention trigger/);
});

test("Conditions release live validator rejects a self-consistent truncated release against external expectations", () => {
  const snapshot = validSnapshot();
  const expectations = validExpectations(snapshot);
  expectations.expectedCalculationCounts = {
    ...expectations.expectedCalculationCounts,
    human_development: 2,
  };

  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    expectations,
    snapshot,
  );
  assert.equal(report.status, "fail");
  assert.equal(report.externalExpectations.calculationCountsMatched, false);
  assert.match(
    report.errors.join(" "),
    /human_development stored calculation count 1 does not match external expected count 2/,
  );
});

test("Conditions release live validator rejects later global freshness and component mutation history", () => {
  const snapshot = validSnapshot();
  const expectations = validExpectations(snapshot);
  snapshot.sourceFreshness[0] = {
    ...snapshot.sourceFreshness[0],
    lastSyncAt: SYNCED_AT,
    matchesReleaseCreatedAt: false,
  };
  snapshot.mutationCounts.push({
    entityTable: "civica_conditions_components",
    rows: 1,
  });

  const report = validateConditionsReleaseSnapshot(
    RELEASE_ID,
    expectations,
    snapshot,
  );
  assert.equal(report.status, "fail");
  assert.equal(report.sourceFreshness.releaseTimestampMismatches, 1);
  assert.equal(report.replay.mutationHistoryEmpty, false);
  assert.match(report.errors.join(" "), /does not exactly equal release created_at/);
  assert.match(report.errors.join(" "), /retained update or delete history/);
});

test("Conditions release live validator requires complete external expectations", () => {
  const snapshot = validSnapshot();
  assert.deepEqual(conditionsReleaseValidationExpectationErrors(null), [
    "external release expectations are required",
  ]);
  const report = validateConditionsReleaseSnapshot(RELEASE_ID, null, snapshot);
  assert.equal(report.status, "fail");
  assert.match(report.errors.join(" "), /external release expectations are required/);
});

test("Conditions live command is injected, read-only, and has no local-env fallback", () => {
  const source = readFileSync(
    "scripts/validate-conditions-release.ts",
    "utf8",
  );
  const targetSource = readFileSync("src/lib/qa/neon-target.ts", "utf8");
  assert.match(source, /--release-id=/);
  assert.match(source, /--expectations-input=/);
  assert.match(source, /--expected-expectations-sha256=/);
  assert.match(source, /parseConditionsReleaseExpectationsArtifact/);
  assert.match(source, /conditionsReleaseExpectationTargetsMatch/);
  assert.match(source, /neonTargetExpectationsFromArguments/);
  assert.match(targetSource, /--expected-project=/);
  assert.match(targetSource, /--expected-branch=/);
  assert.match(targetSource, /--expected-hostname-sha256=/);
  assert.match(targetSource, /--forbidden-branch=/);
  assert.match(targetSource, /--forbidden-hostname-sha256=/);
  assert.match(targetSource, /--required-migration-head=/);
  assert.match(source, /process\.env\.DATABASE_URL/);
  assert.match(source, /readOnly: true/);
  assert.match(source, /isolationLevel: "RepeatableRead"/);
  assert.doesNotMatch(source, /dotenv|\.env\.local/);
  assert.doesNotMatch(
    source,
    /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i,
  );
  assert.match(source, /civica_conditions_components/);
  assert.match(source, /before ->> 'calculation_key'/);
  assert.match(source, /after ->> 'calculation_key'/);
  assert.match(source, /trigger\.tgenabled AS enabled/);
  assert.match(source, /pg_get_functiondef\(function\.oid\)/);
});
