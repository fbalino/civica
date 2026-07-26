import { readFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

import {
  conditionsReleaseExpectationTargetsMatch,
  conditionsReleaseExpectationsArtifactSha256,
  parseConditionsReleaseExpectationsArtifact,
} from "../src/lib/conditions/release-expectations";
import {
  CONDITIONS_RELEASE_RETAINED_TABLES,
  CONDITIONS_RELEASE_VALIDATION_CONTRACT,
  CONDITIONS_RELEASE_VALIDATION_LIMITS,
  validateConditionsReleaseSnapshot,
  type ConditionsReleaseValidationExpectations,
  type ConditionsReleaseValidationSnapshot,
} from "../src/lib/conditions/release-live-validation";
import {
  inspectNeonTarget,
  neonTargetExpectationsFromArguments,
  type NeonTargetExpectations,
} from "../src/lib/qa/neon-target";

const RELEASE_ID = process.argv
  .find((argument) => argument.startsWith("--release-id="))
  ?.slice("--release-id=".length);

function requiredReleaseId(): string {
  if (
    !RELEASE_ID ||
    !/^conditions-[a-z0-9-]+-v[1-9][0-9]*$/.test(RELEASE_ID)
  ) {
    throw new Error("explicit_release_id_required");
  }
  return RELEASE_ID;
}

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("injected_database_url_required");
  return value;
}

function requiredArgument(prefix: string): string {
  const value = process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
  if (!value) throw new Error("external_release_expectations_required");
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function boolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function number(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : number(value);
}

function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function loadSnapshot(
  databaseUrl: string,
  releaseId: string,
): Promise<ConditionsReleaseValidationSnapshot> {
  const sql = neon(databaseUrl, {
    isolationLevel: "RepeatableRead",
    readOnly: true,
  });
  const [
    releaseRows,
    calculationRows,
    componentRows,
    scoreRows,
    referenceSetRows,
    parameterRows,
    freshnessRows,
    triggerRows,
    mutationRows,
  ] = await sql.transaction(
    (transaction) => [
      transaction`
        SELECT
          id AS release_id,
          methodology_version,
          manifest_sha256,
          to_char(
            created_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) AS created_at,
          to_char(
            statement_timestamp() AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) AS observed_at
        FROM civica_conditions_releases
        WHERE id = ${releaseId}
        LIMIT 2
      `,
      transaction`
        SELECT
          calculation_key,
          release_id,
          jurisdiction_id::text AS jurisdiction_id,
          dimension,
          methodology_version,
          alignment_policy,
          alignment_status,
          reference_year
        FROM civica_conditions_calculations
        WHERE release_id = ${releaseId}
        ORDER BY calculation_key
        LIMIT ${CONDITIONS_RELEASE_VALIDATION_LIMITS.calculations + 1}
      `,
      transaction`
        SELECT
          component.calculation_key,
          component.component_id,
          component.native_value,
          component.native_unit,
          component.reference_year,
          component.value_status,
          component.value_status_reason,
          component.inclusion_decision,
          component.source_id,
          component.indicator_id,
          component.upstream_release,
          component.artifact_hash,
          component.artifact_kind,
          component.temporal_coverage,
          component.license_url,
          component.transformation_id,
          component.substitution_reason,
          component.method_version
        FROM civica_conditions_components component
        JOIN civica_conditions_calculations calculation
          ON calculation.calculation_key = component.calculation_key
        WHERE calculation.release_id = ${releaseId}
        ORDER BY component.calculation_key, component.component_id
        LIMIT ${CONDITIONS_RELEASE_VALIDATION_LIMITS.components + 1}
      `,
      transaction`
        SELECT
          score.calculation_key,
          score.release_id,
          score.jurisdiction_id::text AS jurisdiction_id,
          score.dimension,
          score.quarter,
          score.normalized_score,
          score.raw_value,
          score.source_id,
          score.indicator_id,
          score.upstream_release,
          score.artifact_hash,
          score.artifact_kind,
          score.temporal_coverage,
          score.license_url,
          score.transformation_id,
          score.substitution_reason,
          score.method_version,
          score.dataset_year,
          score.methodology_version
        FROM civica_conditions_scores score
        WHERE score.release_id = ${releaseId}
           OR EXISTS (
             SELECT 1
             FROM civica_conditions_calculations calculation
             WHERE calculation.release_id = ${releaseId}
               AND calculation.calculation_key = score.calculation_key
           )
        ORDER BY score.calculation_key, score.id
        LIMIT ${CONDITIONS_RELEASE_VALIDATION_LIMITS.scores + 1}
      `,
      transaction`
        SELECT
          release_id,
          dimension,
          reference_period,
          jurisdiction_ids,
          population_sha256,
          candidate_count,
          aligned_count,
          mixed_year_refused_count,
          missing_component_count,
          included_components,
          missingness_policy
        FROM civica_conditions_reference_sets
        WHERE release_id = ${releaseId}
        ORDER BY dimension, reference_period
        LIMIT ${CONDITIONS_RELEASE_VALIDATION_LIMITS.referenceSets + 1}
      `,
      transaction`
        SELECT
          release_id,
          dimension,
          reference_period,
          component_id,
          direction,
          transformation_id,
          mean,
          standard_deviation,
          lower_bound,
          upper_bound
        FROM civica_conditions_normalization_parameters
        WHERE release_id = ${releaseId}
        ORDER BY dimension, reference_period, component_id
        LIMIT ${CONDITIONS_RELEASE_VALIDATION_LIMITS.normalizationParameters + 1}
      `,
      transaction`
        SELECT DISTINCT
          component.source_id,
          to_char(
            source.last_sync_at AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
          ) AS last_sync_at,
          source.last_sync_at = release.created_at
            AS matches_release_created_at
        FROM civica_conditions_components component
        JOIN civica_conditions_calculations calculation
          ON calculation.calculation_key = component.calculation_key
        JOIN civica_conditions_releases release
          ON release.id = calculation.release_id
        LEFT JOIN sources source ON source.id = component.source_id
        WHERE calculation.release_id = ${releaseId}
        ORDER BY component.source_id
      `,
      transaction`
        SELECT
          relation.relname AS entity_table,
          pg_get_triggerdef(trigger.oid) AS definition,
          trigger.tgenabled AS enabled,
          pg_get_functiondef(function.oid) AS function_definition
        FROM pg_trigger trigger
        JOIN pg_class relation ON relation.oid = trigger.tgrelid
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        JOIN pg_proc function ON function.oid = trigger.tgfoid
        WHERE namespace.nspname = 'public'
          AND NOT trigger.tgisinternal
          AND relation.relname = ANY(${[...CONDITIONS_RELEASE_RETAINED_TABLES]}::text[])
          AND function.proname = 'civica_capture_research_evidence_history'
        ORDER BY relation.relname
      `,
      transaction`
        SELECT entity_table, count(*)::int AS rows
        FROM research_evidence_history
        WHERE entity_table = ANY(${[...CONDITIONS_RELEASE_RETAINED_TABLES]}::text[])
          AND (
            before ->> 'release_id' = ${releaseId}
            OR after ->> 'release_id' = ${releaseId}
            OR (
              entity_table = 'civica_conditions_releases'
              AND (
                before ->> 'id' = ${releaseId}
                OR after ->> 'id' = ${releaseId}
              )
            )
            OR (
              entity_table = 'civica_conditions_components'
              AND (
                before ->> 'calculation_key' IN (
                  SELECT calculation_key
                  FROM civica_conditions_calculations
                  WHERE release_id = ${releaseId}
                )
                OR after ->> 'calculation_key' IN (
                  SELECT calculation_key
                  FROM civica_conditions_calculations
                  WHERE release_id = ${releaseId}
                )
              )
            )
          )
        GROUP BY entity_table
        ORDER BY entity_table
      `,
    ],
    {
      isolationLevel: "RepeatableRead",
      readOnly: true,
    },
  );

  if (releaseRows.length > 1) {
    throw new Error("release_identity_not_unique");
  }
  const releaseRow = releaseRows[0];
  return {
    release: releaseRow
      ? {
          releaseId: text(releaseRow.release_id),
          methodologyVersion: text(releaseRow.methodology_version),
          manifestSha256: text(releaseRow.manifest_sha256),
          createdAt: text(releaseRow.created_at),
          observedAt: text(releaseRow.observed_at),
        }
      : null,
    calculations: calculationRows.map((row) => ({
      calculationKey: text(row.calculation_key),
      releaseId: nullableText(row.release_id),
      jurisdictionId: text(row.jurisdiction_id),
      dimension: text(row.dimension),
      methodologyVersion: text(row.methodology_version),
      alignmentPolicy: text(row.alignment_policy),
      alignmentStatus: text(row.alignment_status),
      referenceYear: nullableNumber(row.reference_year),
    })),
    components: componentRows.map((row) => ({
      calculationKey: text(row.calculation_key),
      componentId: text(row.component_id),
      nativeValue: nullableNumber(row.native_value),
      nativeUnit: text(row.native_unit),
      referenceYear: nullableNumber(row.reference_year),
      valueStatus: text(row.value_status),
      valueStatusReason: nullableText(row.value_status_reason),
      inclusionDecision: text(row.inclusion_decision),
      sourceId: text(row.source_id),
      indicatorId: text(row.indicator_id),
      upstreamRelease: text(row.upstream_release),
      artifactHash: text(row.artifact_hash),
      artifactKind: text(row.artifact_kind),
      temporalCoverage: text(row.temporal_coverage),
      licenseUrl: text(row.license_url),
      transformationId: text(row.transformation_id),
      substitutionReason: nullableText(row.substitution_reason),
      methodVersion: text(row.method_version),
    })),
    scores: scoreRows.map((row) => ({
      calculationKey: nullableText(row.calculation_key),
      releaseId: nullableText(row.release_id),
      jurisdictionId: text(row.jurisdiction_id),
      dimension: text(row.dimension),
      quarter: text(row.quarter),
      normalizedScore: number(row.normalized_score),
      rawValue: nullableNumber(row.raw_value),
      sourceId: text(row.source_id),
      indicatorId: text(row.indicator_id),
      upstreamRelease: text(row.upstream_release),
      artifactHash: text(row.artifact_hash),
      artifactKind: text(row.artifact_kind),
      temporalCoverage: text(row.temporal_coverage),
      licenseUrl: text(row.license_url),
      transformationId: text(row.transformation_id),
      substitutionReason: nullableText(row.substitution_reason),
      methodVersion: text(row.method_version),
      datasetYear: number(row.dataset_year),
      methodologyVersion: text(row.methodology_version),
    })),
    referenceSets: referenceSetRows.map((row) => ({
      releaseId: text(row.release_id),
      dimension: text(row.dimension),
      referencePeriod: text(row.reference_period),
      jurisdictionIds: json(row.jurisdiction_ids),
      populationSha256: text(row.population_sha256),
      candidateCount: number(row.candidate_count),
      alignedCount: number(row.aligned_count),
      mixedYearRefusedCount: number(row.mixed_year_refused_count),
      missingComponentCount: number(row.missing_component_count),
      includedComponents: json(row.included_components),
      missingnessPolicy: text(row.missingness_policy),
    })),
    normalizationParameters: parameterRows.map((row) => ({
      releaseId: text(row.release_id),
      dimension: text(row.dimension),
      referencePeriod: text(row.reference_period),
      componentId: text(row.component_id),
      direction: text(row.direction),
      transformationId: text(row.transformation_id),
      mean: nullableNumber(row.mean),
      standardDeviation: nullableNumber(row.standard_deviation),
      lowerBound: nullableNumber(row.lower_bound),
      upperBound: nullableNumber(row.upper_bound),
    })),
    sourceFreshness: freshnessRows.map((row) => ({
      sourceId: text(row.source_id),
      lastSyncAt: nullableText(row.last_sync_at),
      matchesReleaseCreatedAt: boolean(row.matches_release_created_at),
    })),
    retentionTriggers: triggerRows.map((row) => ({
      entityTable: text(row.entity_table),
      definition: text(row.definition),
      enabled: text(row.enabled),
      functionDefinition: text(row.function_definition),
    })),
    mutationCounts: mutationRows.map((row) => ({
      entityTable: text(row.entity_table),
      rows: number(row.rows),
    })),
  };
}

function failureReport(releaseId: string | null, error: string) {
  return {
    contract: CONDITIONS_RELEASE_VALIDATION_CONTRACT,
    status: "fail",
    releaseId,
    errorCount: 1,
    errorsTruncated: false,
    errors: [error],
  };
}

async function main(): Promise<void> {
  let releaseId: string;
  let databaseUrl: string;
  let expectationsInput: string;
  let expectedExpectationsSha256: string;
  let targetExpectations: NeonTargetExpectations;
  try {
    releaseId = requiredReleaseId();
    expectationsInput = requiredArgument("--expectations-input=");
    expectedExpectationsSha256 = requiredArgument(
      "--expected-expectations-sha256=",
    );
    if (!/^[a-f0-9]{64}$/.test(expectedExpectationsSha256)) {
      throw new Error("invalid_external_release_expectations");
    }
    targetExpectations = neonTargetExpectationsFromArguments(process.argv);
    databaseUrl = requiredDatabaseUrl();
  } catch (error) {
    const code =
      error instanceof Error ? error.message : "invalid_validator_input";
    console.log(JSON.stringify(failureReport(RELEASE_ID ?? null, code), null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const serializedExpectations = await readFile(expectationsInput, "utf8");
    const expectationsArtifactSha256 =
      conditionsReleaseExpectationsArtifactSha256(serializedExpectations);
    if (expectationsArtifactSha256 !== expectedExpectationsSha256) {
      throw new Error("expectations_artifact_hash_mismatch");
    }
    const artifact = parseConditionsReleaseExpectationsArtifact(
      serializedExpectations,
    );
    if (artifact.releaseId !== releaseId) {
      throw new Error("expectations_artifact_release_mismatch");
    }
    const expectations: ConditionsReleaseValidationExpectations = {
      releaseManifestSha256: artifact.releaseManifestSha256,
      expectedCalculationCounts: artifact.expectedCalculationCounts,
    };
    const databaseTarget = await inspectNeonTarget({
      databaseUrl,
      sql: neon(databaseUrl),
      expectations: targetExpectations,
    });
    if (
      !conditionsReleaseExpectationTargetsMatch(
        artifact.databaseTarget,
        databaseTarget,
      )
    ) {
      throw new Error("expectations_artifact_target_mismatch");
    }
    const snapshot = await loadSnapshot(databaseUrl, releaseId);
    const report = validateConditionsReleaseSnapshot(
      releaseId,
      expectations,
      snapshot,
    );
    console.log(
      JSON.stringify(
        { ...report, expectationsArtifactSha256, databaseTarget },
        null,
        2,
      ),
    );
    if (report.status !== "pass") process.exitCode = 1;
  } catch {
    console.log(
      JSON.stringify(
        failureReport(releaseId, "database_validation_query_failed"),
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
