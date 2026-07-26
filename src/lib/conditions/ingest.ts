import { eq } from "drizzle-orm";
import { createServerlessSql } from "@/lib/db";
import {
  civicaConditionsCalculations,
  civicaConditionsComponents,
  civicaConditionsNormalizationParameters,
  civicaConditionsReferenceSets,
  civicaConditionsReleases,
  civicaConditionsScores,
} from "@/lib/db/schema";
import {
  createDeferredSourceFreshness,
  markSourcesSynced,
  markSourcesSyncedFromInsertedReleaseCte,
} from "@/lib/db/source-freshness";
import {
  conditionCalculationErrors,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "./contract";
import {
  conditionsReferencePopulationSha256,
  conditionsReleaseErrors,
  conditionsReleaseManifestSha256,
  type ConditionsReleaseInput,
} from "./release";

type Db = typeof import("@/lib/db").db;
type ConditionsNeonSql = ReturnType<typeof createServerlessSql>;
export type { ConditionScoreInput } from "./contract";

export interface WriteConditionsReleaseOptions {
  dryRun?: boolean;
  markSynced?: typeof markSourcesSynced;
  /** Injectable Neon HTTP client for deterministic transaction-plan tests. */
  neonSql?: ConditionsNeonSql;
  /**
   * PGlite fixture compatibility only. Production must use the default
   * `neon-http` path because Drizzle's Neon HTTP driver has no callback
   * transaction support.
   */
  transactionMode?: "neon-http" | "drizzle-fixture";
}

interface ConditionsWriteSummary {
  proposed: number;
  written: number;
  calculationsWritten: number;
  componentsWritten: number;
}

interface AtomicReleasePayload {
  referenceSets: Array<Record<string, unknown>>;
  parameters: Array<Record<string, unknown>>;
  calculations: Array<Record<string, unknown>>;
  components: Array<Record<string, unknown>>;
  scores: Array<Record<string, unknown>>;
  sourceIds: string[];
}

interface AtomicPublishResult {
  releases_written: number | string;
  reference_sets_written: number | string;
  parameters_written: number | string;
  calculations_written: number | string;
  components_written: number | string;
  scores_written: number | string;
  sources_stamped: number | string;
}

const CONDITIONS_RELEASE_ATOMIC_PUBLISH_SQL = `
WITH
inserted_release AS (
  INSERT INTO civica_conditions_releases (
    id,
    methodology_version,
    manifest_sha256
  )
  VALUES ($1, $2, $3)
  ON CONFLICT (id) DO NOTHING
  RETURNING id, created_at
),
reference_input AS (
  SELECT *
  FROM jsonb_to_recordset(($4::jsonb)->'referenceSets') AS input(
    dimension text,
    "referencePeriod" text,
    "jurisdictionIds" jsonb,
    "populationSha256" text,
    "candidateCount" integer,
    "alignedCount" integer,
    "mixedYearRefusedCount" integer,
    "missingComponentCount" integer,
    "includedComponents" jsonb,
    "missingnessPolicy" text
  )
),
inserted_reference_sets AS (
  INSERT INTO civica_conditions_reference_sets (
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
  )
  SELECT
    release.id,
    input.dimension,
    input."referencePeriod",
    input."jurisdictionIds",
    input."populationSha256",
    input."candidateCount",
    input."alignedCount",
    input."mixedYearRefusedCount",
    input."missingComponentCount",
    input."includedComponents",
    input."missingnessPolicy"
  FROM reference_input AS input
  CROSS JOIN inserted_release AS release
  RETURNING release_id, dimension, reference_period
),
parameter_input AS (
  SELECT *
  FROM jsonb_to_recordset(($4::jsonb)->'parameters') AS input(
    dimension text,
    "referencePeriod" text,
    "componentId" text,
    direction text,
    "transformationId" text,
    mean real,
    "standardDeviation" real,
    "lowerBound" real,
    "upperBound" real
  )
),
inserted_parameters AS (
  INSERT INTO civica_conditions_normalization_parameters (
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
  )
  SELECT
    release.id,
    input.dimension,
    input."referencePeriod",
    input."componentId",
    input.direction,
    input."transformationId",
    input.mean,
    input."standardDeviation",
    input."lowerBound",
    input."upperBound"
  FROM parameter_input AS input
  JOIN inserted_reference_sets AS reference_set
    ON reference_set.dimension = input.dimension
    AND reference_set.reference_period = input."referencePeriod"
  JOIN inserted_release AS release
    ON release.id = reference_set.release_id
  RETURNING release_id
),
calculation_input AS (
  SELECT *
  FROM jsonb_to_recordset(($4::jsonb)->'calculations') AS input(
    "calculationKey" text,
    "jurisdictionId" uuid,
    dimension text,
    "methodologyVersion" text,
    "alignmentPolicy" text,
    "alignmentStatus" text,
    "referenceYear" integer
  )
),
inserted_calculations AS (
  INSERT INTO civica_conditions_calculations (
    calculation_key,
    release_id,
    jurisdiction_id,
    dimension,
    methodology_version,
    alignment_policy,
    alignment_status,
    reference_year
  )
  SELECT
    input."calculationKey",
    release.id,
    input."jurisdictionId",
    input.dimension,
    input."methodologyVersion",
    input."alignmentPolicy",
    input."alignmentStatus",
    input."referenceYear"
  FROM calculation_input AS input
  CROSS JOIN inserted_release AS release
  RETURNING calculation_key
),
component_input AS (
  SELECT *
  FROM jsonb_to_recordset(($4::jsonb)->'components') AS input(
    "calculationKey" text,
    "componentId" text,
    "nativeValue" real,
    "nativeUnit" text,
    "referenceYear" integer,
    "valueStatus" text,
    "valueStatusReason" text,
    "inclusionDecision" text,
    "sourceId" text,
    "indicatorId" text,
    "upstreamRelease" text,
    "artifactHash" text,
    "artifactKind" text,
    "temporalCoverage" text,
    "licenseUrl" text,
    "transformationId" text,
    "substitutionReason" text,
    "methodVersion" text
  )
),
inserted_components AS (
  INSERT INTO civica_conditions_components (
    calculation_key,
    component_id,
    native_value,
    native_unit,
    reference_year,
    value_status,
    value_status_reason,
    inclusion_decision,
    source_id,
    indicator_id,
    upstream_release,
    artifact_hash,
    artifact_kind,
    temporal_coverage,
    license_url,
    transformation_id,
    substitution_reason,
    method_version
  )
  SELECT
    input."calculationKey",
    input."componentId",
    input."nativeValue",
    input."nativeUnit",
    input."referenceYear",
    input."valueStatus",
    input."valueStatusReason",
    input."inclusionDecision",
    input."sourceId",
    input."indicatorId",
    input."upstreamRelease",
    input."artifactHash",
    input."artifactKind",
    input."temporalCoverage",
    input."licenseUrl",
    input."transformationId",
    input."substitutionReason",
    input."methodVersion"
  FROM component_input AS input
  JOIN inserted_calculations AS calculation
    ON calculation.calculation_key = input."calculationKey"
  RETURNING source_id
),
score_input AS (
  SELECT *
  FROM jsonb_to_recordset(($4::jsonb)->'scores') AS input(
    "jurisdictionId" uuid,
    dimension text,
    quarter text,
    "normalizedScore" real,
    "rawValue" real,
    "sourceId" text,
    "indicatorId" text,
    "upstreamRelease" text,
    "artifactHash" text,
    "artifactKind" text,
    "temporalCoverage" text,
    "licenseUrl" text,
    "transformationId" text,
    "substitutionReason" text,
    "methodVersion" text,
    "datasetYear" integer,
    "methodologyVersion" text,
    "calculationKey" text
  )
),
inserted_scores AS (
  INSERT INTO civica_conditions_scores (
    jurisdiction_id,
    dimension,
    quarter,
    normalized_score,
    raw_value,
    source_id,
    indicator_id,
    upstream_release,
    artifact_hash,
    artifact_kind,
    temporal_coverage,
    license_url,
    transformation_id,
    substitution_reason,
    method_version,
    dataset_year,
    methodology_version,
    release_id,
    calculation_key
  )
  SELECT
    input."jurisdictionId",
    input.dimension,
    input.quarter,
    input."normalizedScore",
    input."rawValue",
    input."sourceId",
    input."indicatorId",
    input."upstreamRelease",
    input."artifactHash",
    input."artifactKind",
    input."temporalCoverage",
    input."licenseUrl",
    input."transformationId",
    input."substitutionReason",
    input."methodVersion",
    input."datasetYear",
    input."methodologyVersion",
    release.id,
    input."calculationKey"
  FROM score_input AS input
  JOIN inserted_calculations AS calculation
    ON calculation.calculation_key = input."calculationKey"
  CROSS JOIN inserted_release AS release
  RETURNING id
),
inserted_source_rows AS (
  SELECT DISTINCT source_id
  FROM inserted_components
),
${markSourcesSyncedFromInsertedReleaseCte()}
SELECT
  (SELECT count(*)::int FROM inserted_release) AS releases_written,
  (SELECT count(*)::int FROM inserted_reference_sets) AS reference_sets_written,
  (SELECT count(*)::int FROM inserted_parameters) AS parameters_written,
  (SELECT count(*)::int FROM inserted_calculations) AS calculations_written,
  (SELECT count(*)::int FROM inserted_components) AS components_written,
  (SELECT count(*)::int FROM inserted_scores) AS scores_written,
  (SELECT count(*)::int FROM stamped_sources) AS sources_stamped,
  1 / CASE
    WHEN NOT EXISTS (SELECT 1 FROM inserted_release)
      OR (
        (SELECT count(*) FROM inserted_reference_sets) = jsonb_array_length(($4::jsonb)->'referenceSets')
        AND (SELECT count(*) FROM inserted_parameters) = jsonb_array_length(($4::jsonb)->'parameters')
        AND (SELECT count(*) FROM inserted_calculations) = jsonb_array_length(($4::jsonb)->'calculations')
        AND (SELECT count(*) FROM inserted_components) = jsonb_array_length(($4::jsonb)->'components')
        AND (SELECT count(*) FROM inserted_scores) = jsonb_array_length(($4::jsonb)->'scores')
        AND (SELECT count(*) FROM stamped_sources) = jsonb_array_length(($4::jsonb)->'sourceIds')
      )
    THEN 1
    ELSE 0
  END AS cardinality_guard
`;

const CONDITIONS_RELEASE_MANIFEST_SQL = `
SELECT manifest_sha256
FROM civica_conditions_releases
WHERE id = $1
LIMIT 1
`;

export async function writeConditionsRelease(
  db: Db,
  release: ConditionsReleaseInput,
  rows: ConditionScoreInput[],
  options: WriteConditionsReleaseOptions = {},
): Promise<ConditionsWriteSummary> {
  const errors = conditionsReleaseErrors(release, rows);
  if (errors.length) throw new Error(`Invalid Conditions release: ${errors.join(", ")}`);
  assertValidConditionRows(rows);
  const manifestSha256 = conditionsReleaseManifestSha256(release, rows);
  if (options.dryRun) {
    return writeConditionScores(db, rows, { ...options, dryRun: true });
  }
  if (options.transactionMode === "drizzle-fixture") {
    if (options.neonSql) {
      throw new Error(
        "Conditions release writer cannot combine Neon SQL with the Drizzle fixture transaction",
      );
    }
    return writeConditionsReleaseWithDrizzleFixture(
      db,
      release,
      rows,
      manifestSha256,
      options,
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!options.neonSql && !databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for atomic Conditions release writes",
    );
  }
  const neonSql =
    options.neonSql ?? createServerlessSql(databaseUrl as string);
  return writeConditionsReleaseWithNeon(
    neonSql,
    release,
    rows,
    manifestSha256,
  );
}

async function writeConditionsReleaseWithDrizzleFixture(
  db: Db,
  release: ConditionsReleaseInput,
  rows: ConditionScoreInput[],
  manifestSha256: string,
  options: WriteConditionsReleaseOptions,
): Promise<ConditionsWriteSummary> {
  return db.transaction(async (tx) => {
    const executor = tx as unknown as Db;
    const existing = await executor
      .select({ manifestSha256: civicaConditionsReleases.manifestSha256 })
      .from(civicaConditionsReleases)
      .where(eq(civicaConditionsReleases.id, release.releaseId))
      .limit(1);
    if (existing.length) {
      if (existing[0].manifestSha256 !== manifestSha256) {
        throw new Error(`Conditions release ${release.releaseId} already exists with a different manifest`);
      }
      return { proposed: rows.length, written: 0, calculationsWritten: 0, componentsWritten: 0 };
    }
    await executor.insert(civicaConditionsReleases).values({
      id: release.releaseId,
      methodologyVersion: release.methodologyVersion,
      manifestSha256,
    });
    for (const referenceSet of release.referenceSets) {
      await executor.insert(civicaConditionsReferenceSets).values({
        releaseId: release.releaseId,
        dimension: referenceSet.dimension,
        referencePeriod: referenceSet.referencePeriod,
        jurisdictionIds: [...referenceSet.jurisdictionIds].sort(),
        populationSha256: conditionsReferencePopulationSha256(referenceSet.jurisdictionIds),
        candidateCount: referenceSet.candidateCount,
        alignedCount: referenceSet.alignedCount,
        mixedYearRefusedCount: referenceSet.mixedYearRefusedCount,
        missingComponentCount: referenceSet.missingComponentCount,
        includedComponents: [...referenceSet.includedComponents],
        missingnessPolicy: referenceSet.missingnessPolicy,
      });
      for (const parameter of referenceSet.parameters) {
        await executor.insert(civicaConditionsNormalizationParameters).values({
        releaseId: release.releaseId,
        dimension: referenceSet.dimension,
        referencePeriod: referenceSet.referencePeriod,
        componentId: parameter.componentId,
        direction: parameter.direction,
        transformationId: parameter.transformationId,
        mean: parameter.mean,
        standardDeviation: parameter.standardDeviation,
        lowerBound: parameter.lowerBound,
        upperBound: parameter.upperBound,
        });
      }
    }
    const deferredFreshness = createDeferredSourceFreshness();
    const summary = await writeConditionScores(executor, rows, {
      ...options,
      markSynced: deferredFreshness.capture,
    });
    await deferredFreshness.flush({
      executor: tx,
      timestampSource: "database",
    });
    return summary;
  });
}

function atomicReleasePayload(
  release: ConditionsReleaseInput,
  rows: ConditionScoreInput[],
): AtomicReleasePayload {
  const referenceSets = release.referenceSets.map((referenceSet) => ({
    dimension: referenceSet.dimension,
    referencePeriod: referenceSet.referencePeriod,
    jurisdictionIds: [...referenceSet.jurisdictionIds].sort(),
    populationSha256: conditionsReferencePopulationSha256(
      referenceSet.jurisdictionIds,
    ),
    candidateCount: referenceSet.candidateCount,
    alignedCount: referenceSet.alignedCount,
    mixedYearRefusedCount: referenceSet.mixedYearRefusedCount,
    missingComponentCount: referenceSet.missingComponentCount,
    includedComponents: [...referenceSet.includedComponents],
    missingnessPolicy: referenceSet.missingnessPolicy,
  }));
  const parameters = release.referenceSets.flatMap((referenceSet) =>
    referenceSet.parameters.map((parameter) => ({
      dimension: referenceSet.dimension,
      referencePeriod: referenceSet.referencePeriod,
      componentId: parameter.componentId,
      direction: parameter.direction,
      transformationId: parameter.transformationId,
      mean: parameter.mean,
      standardDeviation: parameter.standardDeviation,
      lowerBound: parameter.lowerBound,
      upperBound: parameter.upperBound,
    })),
  );
  const calculations = rows.map((row) => ({
    calculationKey: row.calculationKey,
    jurisdictionId: row.jurisdictionId,
    dimension: row.dimension,
    methodologyVersion: row.methodologyVersion,
    alignmentPolicy: row.alignmentPolicy,
    alignmentStatus: row.alignmentStatus,
    referenceYear: row.referenceYear,
  }));
  const components = rows.flatMap((row) =>
    row.components.map((component) => ({
      calculationKey: row.calculationKey,
      componentId: component.componentId,
      nativeValue: component.nativeValue,
      nativeUnit: component.nativeUnit,
      referenceYear: component.referenceYear,
      valueStatus: component.valueStatus,
      valueStatusReason: component.valueStatusReason,
      inclusionDecision: component.inclusionDecision,
      sourceId: component.sourceId,
      indicatorId: component.indicatorId,
      upstreamRelease: component.upstreamRelease,
      artifactHash: component.artifactHash,
      artifactKind: component.artifactKind,
      temporalCoverage: component.temporalCoverage,
      licenseUrl: component.licenseUrl,
      transformationId: component.transformationId,
      substitutionReason: component.substitutionReason,
      methodVersion: component.methodVersion,
    })),
  );
  const scores = rows
    .filter(
      (
        row,
      ): row is ConditionScoreInput & {
        normalizedScore: number;
        rawValue: number;
        quarter: string;
        datasetYear: number;
      } =>
        row.normalizedScore !== null &&
        row.rawValue !== null &&
        row.quarter !== null &&
        row.datasetYear !== null,
    )
    .map((row) => ({
      jurisdictionId: row.jurisdictionId,
      dimension: row.dimension,
      quarter: row.quarter,
      normalizedScore: row.normalizedScore,
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
      datasetYear: row.datasetYear,
      methodologyVersion: row.methodologyVersion,
      calculationKey: row.calculationKey,
    }));
  const sourceIds = [
    ...new Set(components.map((component) => String(component.sourceId))),
  ];
  return {
    referenceSets,
    parameters,
    calculations,
    components,
    scores,
    sourceIds,
  };
}

function atomicCount(
  row: AtomicPublishResult,
  key: keyof AtomicPublishResult,
): number {
  const count = Number(row[key]);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Conditions atomic writer returned an invalid ${key}`);
  }
  return count;
}

async function writeConditionsReleaseWithNeon(
  neonSql: ConditionsNeonSql,
  release: ConditionsReleaseInput,
  rows: ConditionScoreInput[],
  manifestSha256: string,
): Promise<ConditionsWriteSummary> {
  const payload = atomicReleasePayload(release, rows);
  const results = await neonSql.transaction(
    (transaction) => [
      transaction.query(CONDITIONS_RELEASE_ATOMIC_PUBLISH_SQL, [
        release.releaseId,
        release.methodologyVersion,
        manifestSha256,
        JSON.stringify(payload),
      ]),
      transaction.query(CONDITIONS_RELEASE_MANIFEST_SQL, [release.releaseId]),
    ],
    { isolationLevel: "ReadCommitted" },
  );
  const publishRows = results[0] as unknown as AtomicPublishResult[];
  const manifestRows = results[1] as unknown as Array<{
    manifest_sha256?: unknown;
  }>;
  const publish = publishRows[0];
  if (!publish) {
    throw new Error("Conditions atomic writer returned no publication result");
  }
  const releaseWritten = atomicCount(publish, "releases_written");
  if (releaseWritten > 1) {
    throw new Error("Conditions atomic writer inserted multiple release headers");
  }
  const storedManifest = manifestRows[0]?.manifest_sha256;
  if (typeof storedManifest !== "string") {
    throw new Error(
      `Conditions release ${release.releaseId} has no readable manifest after the atomic transaction`,
    );
  }
  if (storedManifest !== manifestSha256) {
    throw new Error(
      `Conditions release ${release.releaseId} already exists with a different manifest`,
    );
  }
  if (releaseWritten === 0) {
    for (const key of [
      "reference_sets_written",
      "parameters_written",
      "calculations_written",
      "components_written",
      "scores_written",
      "sources_stamped",
    ] as const) {
      if (atomicCount(publish, key) !== 0) {
        throw new Error(
          `Conditions existing-release transaction unexpectedly changed ${key}`,
        );
      }
    }
    return {
      proposed: rows.length,
      written: 0,
      calculationsWritten: 0,
      componentsWritten: 0,
    };
  }

  const expected = {
    reference_sets_written: payload.referenceSets.length,
    parameters_written: payload.parameters.length,
    calculations_written: payload.calculations.length,
    components_written: payload.components.length,
    scores_written: payload.scores.length,
    sources_stamped: payload.sourceIds.length,
  } as const;
  for (const [key, expectedCount] of Object.entries(expected) as Array<
    [keyof typeof expected, number]
  >) {
    if (atomicCount(publish, key) !== expectedCount) {
      throw new Error(
        `Conditions atomic writer count mismatch for ${key}: expected ${expectedCount}`,
      );
    }
  }
  return {
    proposed: rows.length,
    written: payload.scores.length,
    calculationsWritten: payload.calculations.length,
    componentsWritten: payload.components.length,
  };
}

function assertValidConditionRows(rows: ConditionScoreInput[]): void {
  if (rows.length === 0) throw new Error("Conditions input produced zero rows");
  const calculationKeys = new Set<string>();
  const scoreKeys = new Set<string>();
  for (const row of rows) {
    if (calculationKeys.has(row.calculationKey)) {
      throw new Error(`Duplicate Conditions calculation: ${row.calculationKey}`);
    }
    calculationKeys.add(row.calculationKey);
    const expectedCalculationKey = conditionCalculationKey(row);
    if (row.calculationKey !== expectedCalculationKey) {
      throw new Error(
        `Conditions calculation key does not match its inputs: ${row.calculationKey}`,
      );
    }
    const errors = conditionCalculationErrors(row);
    if (errors.length) {
      throw new Error(
        `Invalid Conditions calculation ${row.calculationKey}: ${errors.join(", ")}`,
      );
    }
    if (row.normalizedScore !== null) {
      const scoreKey = `${row.jurisdictionId}:${row.dimension}:${row.quarter}:${row.methodologyVersion}:${row.sourceId}:${row.indicatorId}`;
      if (scoreKeys.has(scoreKey)) {
        throw new Error(`Duplicate Conditions score: ${scoreKey}`);
      }
      scoreKeys.add(scoreKey);
    }
  }
}

export async function writeConditionScores(
  db: Db,
  rows: ConditionScoreInput[],
  options: { dryRun?: boolean; markSynced?: typeof markSourcesSynced } = {},
): Promise<{
  proposed: number;
  written: number;
  calculationsWritten: number;
  componentsWritten: number;
}> {
  assertValidConditionRows(rows);

  if (!options.dryRun) {
    for (const row of rows) {
      await db.insert(civicaConditionsCalculations).values({
        calculationKey: row.calculationKey,
        releaseId: row.releaseId,
        jurisdictionId: row.jurisdictionId,
        dimension: row.dimension,
        methodologyVersion: row.methodologyVersion,
        alignmentPolicy: row.alignmentPolicy,
        alignmentStatus: row.alignmentStatus,
        referenceYear: row.referenceYear,
      }).onConflictDoUpdate({
        target: [civicaConditionsCalculations.calculationKey],
        set: {
          releaseId: row.releaseId,
          alignmentPolicy: row.alignmentPolicy,
          alignmentStatus: row.alignmentStatus,
          referenceYear: row.referenceYear,
        },
      });
      for (const component of row.components) {
        await db.insert(civicaConditionsComponents).values({
          calculationKey: row.calculationKey,
          componentId: component.componentId,
          nativeValue: component.nativeValue,
          nativeUnit: component.nativeUnit,
          referenceYear: component.referenceYear,
          valueStatus: component.valueStatus,
          valueStatusReason: component.valueStatusReason,
          inclusionDecision: component.inclusionDecision,
          sourceId: component.sourceId,
          indicatorId: component.indicatorId,
          upstreamRelease: component.upstreamRelease,
          artifactHash: component.artifactHash,
          artifactKind: component.artifactKind,
          temporalCoverage: component.temporalCoverage,
          licenseUrl: component.licenseUrl,
          transformationId: component.transformationId,
          substitutionReason: component.substitutionReason,
          methodVersion: component.methodVersion,
        }).onConflictDoUpdate({
          target: [
            civicaConditionsComponents.calculationKey,
            civicaConditionsComponents.componentId,
          ],
          set: {
            nativeValue: component.nativeValue,
            nativeUnit: component.nativeUnit,
            referenceYear: component.referenceYear,
            valueStatus: component.valueStatus,
            valueStatusReason: component.valueStatusReason,
            inclusionDecision: component.inclusionDecision,
            sourceId: component.sourceId,
            indicatorId: component.indicatorId,
            upstreamRelease: component.upstreamRelease,
            artifactHash: component.artifactHash,
            artifactKind: component.artifactKind,
            temporalCoverage: component.temporalCoverage,
            licenseUrl: component.licenseUrl,
            transformationId: component.transformationId,
            substitutionReason: component.substitutionReason,
            methodVersion: component.methodVersion,
          },
        });
      }
      if (
        row.normalizedScore === null ||
        row.rawValue === null ||
        row.quarter === null ||
        row.datasetYear === null
      ) {
        continue;
      }
      await db.insert(civicaConditionsScores).values({
        jurisdictionId: row.jurisdictionId,
        dimension: row.dimension,
        quarter: row.quarter,
        normalizedScore: row.normalizedScore,
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
        datasetYear: row.datasetYear,
        methodologyVersion: row.methodologyVersion,
        releaseId: row.releaseId,
        calculationKey: row.calculationKey,
      }).onConflictDoUpdate({
        target: [civicaConditionsScores.jurisdictionId, civicaConditionsScores.dimension, civicaConditionsScores.quarter, civicaConditionsScores.methodologyVersion, civicaConditionsScores.sourceId, civicaConditionsScores.indicatorId, civicaConditionsScores.releaseId],
        set: {
          normalizedScore: row.normalizedScore,
          rawValue: row.rawValue,
          upstreamRelease: row.upstreamRelease,
          artifactHash: row.artifactHash,
          artifactKind: row.artifactKind,
          temporalCoverage: row.temporalCoverage,
          licenseUrl: row.licenseUrl,
          transformationId: row.transformationId,
          substitutionReason: row.substitutionReason,
          methodVersion: row.methodVersion,
          datasetYear: row.datasetYear,
          releaseId: row.releaseId,
          calculationKey: row.calculationKey,
        },
      });
    }
  }

  const bySource = new Map<string, number>();
  for (const row of rows) {
    for (const component of row.components) {
      bySource.set(component.sourceId, (bySource.get(component.sourceId) ?? 0) + 1);
    }
  }
  for (const [sourceId, count] of bySource) {
    await (options.markSynced ?? markSourcesSynced)(sourceId, { rowsWritten: count, dryRun: options.dryRun });
  }
  return {
    proposed: rows.length,
    written: options.dryRun
      ? 0
      : rows.filter((row) => row.normalizedScore !== null).length,
    calculationsWritten: options.dryRun ? 0 : rows.length,
    componentsWritten: options.dryRun
      ? 0
      : rows.reduce((count, row) => count + row.components.length, 0),
  };
}
