import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import {
  CONDITIONS_ALIGNMENT_POLICY,
  conditionCalculationKey,
  type ConditionScoreInput,
} from "../contract";
import {
  buildEconomicConditionsCalculations,
  buildEconomicReferenceSets,
  type EconomicLineages,
} from "../economic";
import { writeConditionsRelease } from "../ingest";
import {
  buildFixedBoundReferenceSets,
  conditionsReleaseManifestSha256,
} from "../release";

function row(
  rawValue = 0.9,
  releaseId = "conditions-hdi-fixture-v1",
): ConditionScoreInput {
  const base = {
    releaseId,
    jurisdictionId: "11111111-1111-4111-8111-111111111111",
    dimension: "human_development" as const,
    quarter: "2024-Q4",
    normalizedScore: rawValue * 100,
    rawValue,
    sourceId: "undp_hdi",
    indicatorId: "hdi",
    upstreamRelease: "fixture",
    artifactHash: "a".repeat(64),
    artifactKind: "normalized_batch" as const,
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    transformationId: "conditions-hdi-fixed-bound/v2",
    substitutionReason: null,
    methodVersion: "conditions-components/v1",
    datasetYear: 2024,
    methodologyVersion: "conditions-components/v1",
    referenceYear: 2024,
    alignmentPolicy: CONDITIONS_ALIGNMENT_POLICY,
    alignmentStatus: "aligned" as const,
    components: [{
      componentId: "hdi" as const,
      sourceId: "undp_hdi",
      nativeValue: rawValue,
      nativeUnit: "index_0_1",
      referenceYear: 2024,
      valueStatus: "observed" as const,
      valueStatusReason: null,
      inclusionDecision: "included" as const,
      indicatorId: "hdi",
      upstreamRelease: "fixture",
      artifactHash: "a".repeat(64),
      artifactKind: "normalized_batch" as const,
      temporalCoverage: "2024",
      licenseUrl: "https://example.test/terms",
      transformationId: "conditions-hdi-component/v2",
      substitutionReason: null,
      methodVersion: "conditions-components/v1",
    }],
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

async function createDatabase() {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE sources (id text PRIMARY KEY, last_sync_at timestamp);
    CREATE TABLE jurisdictions (id uuid PRIMARY KEY);
    INSERT INTO sources (id) VALUES ('undp_hdi'), ('global_peace_index'), ('worldbank_economic');
    INSERT INTO jurisdictions (id) VALUES ('11111111-1111-4111-8111-111111111111');
    CREATE TABLE civica_conditions_scores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), jurisdiction_id uuid NOT NULL, dimension text NOT NULL, quarter text NOT NULL,
      normalized_score real NOT NULL, raw_value real, source_id text NOT NULL, indicator_id text NOT NULL, upstream_release text NOT NULL,
      artifact_hash text NOT NULL, artifact_kind text NOT NULL, temporal_coverage text NOT NULL, license_url text NOT NULL,
      transformation_id text NOT NULL, substitution_reason text, method_version text NOT NULL, dataset_year integer NOT NULL,
      methodology_version text NOT NULL, created_at timestamp DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX idx_conditions_unique ON civica_conditions_scores (jurisdiction_id, dimension, quarter, methodology_version, source_id, indicator_id);
    CREATE FUNCTION civica_capture_research_evidence_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
  `);
  for (const path of [
    "0040_closed_young_avengers.sql",
    "0042_grey_sally_floyd.sql",
    "0049_curvy_shen.sql",
  ]) {
    await database.exec(readFileSync(`drizzle/authoritative/${path}`, "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function pgliteAtomicNeonSql(database: PGlite) {
  return {
    async transaction(
      build: (transaction: {
        query: (
          sql: string,
          params?: unknown[],
        ) => { sql: string; params: unknown[] };
      }) => Array<{ sql: string; params: unknown[] }>,
    ) {
      const queries = build({
        query(sql, params = []) {
          return { sql, params };
        },
      });
      return database.transaction(async (transaction) => {
        const results = [];
        for (const query of queries) {
          results.push(
            (await transaction.query(query.sql, query.params)).rows,
          );
        }
        return results;
      });
    },
  } as never;
}

function gpiRow(releaseId: string): ConditionScoreInput {
  const base = {
    ...row(0.9, releaseId),
    dimension: "peace_security" as const,
    normalizedScore: 75,
    rawValue: 2,
    sourceId: "global_peace_index",
    indicatorId: "GPI_SCORE",
    transformationId: "conditions-gpi-fixed-bound/v2",
    components: [{
      ...row(0.9, releaseId).components[0],
      componentId: "global_peace_index" as const,
      sourceId: "global_peace_index",
      nativeValue: 2,
      nativeUnit: "index_1_5_inverted",
      indicatorId: "GPI_SCORE",
      transformationId: "conditions-gpi-component/v2",
    }],
  };
  return { ...base, calculationKey: conditionCalculationKey(base) };
}

function economicLineages(): EconomicLineages {
  const common = {
    upstreamRelease: "fixture",
    artifactHash: "e".repeat(64),
    artifactKind: "publisher_bytes" as const,
    temporalCoverage: "2024",
    licenseUrl: "https://example.test/terms",
    substitutionReason: null,
    methodVersion: "conditions-components/v1",
  };
  return {
    score: {
      ...common,
      indicatorId: "FP.CPI.TOTL.ZG+SL.UEM.TOTL.ZS+NY.GDP.MKTP.KD.ZG",
      transformationId: "conditions-economic-source-native/v1",
    },
    components: {
      inflation: {
        ...common,
        indicatorId: "FP.CPI.TOTL.ZG",
        transformationId: "conditions-economic-component/v1",
      },
      unemployment: {
        ...common,
        indicatorId: "SL.UEM.TOTL.ZS",
        transformationId: "conditions-economic-component/v1",
      },
      gdp_growth: {
        ...common,
        indicatorId: "NY.GDP.MKTP.KD.ZG",
        transformationId: "conditions-economic-component/v1",
      },
    },
  };
}

test("Conditions release writer commits one immutable release and rejects a changed rerun", async () => {
  const database = await createDatabase();
  try {
    const db = drizzle(database);
    const first = row();
    const release = {
      releaseId: first.releaseId,
      methodologyVersion: first.methodologyVersion,
      referenceSets: buildFixedBoundReferenceSets({ calculations: [first], componentId: "hdi", direction: "higher_is_better", transformationId: first.transformationId, lowerBound: 0, upperBound: 1 }),
    };
    assert.equal(
      (
        await writeConditionsRelease(db as never, release, [first], {
          neonSql: pgliteAtomicNeonSql(database),
        })
      ).written,
      1,
    );
    const timestampOrder = (
      await database.query<{ ordered: boolean; sameClock: boolean }>(`
        SELECT
          s.last_sync_at >= r.created_at AS ordered,
          s.last_sync_at = r.created_at AS "sameClock"
        FROM sources s
        CROSS JOIN civica_conditions_releases r
        WHERE s.id = 'undp_hdi'
          AND r.id = '${release.releaseId}'
      `)
    ).rows[0];
    assert.deepEqual(timestampOrder, { ordered: true, sameClock: true });
    assert.equal(
      (
        await writeConditionsRelease(db as never, release, [first], {
          neonSql: pgliteAtomicNeonSql(database),
        })
      ).written,
      0,
    );
    await assert.rejects(
      writeConditionsRelease(db as never, release, [row(0.8)], {
        neonSql: pgliteAtomicNeonSql(database),
      }),
      /different manifest/,
    );
    assert.equal((await database.query<{ count: number }>("SELECT count(*)::int AS count FROM civica_conditions_scores")).rows[0].count, 1);
  } finally { await database.close(); }
});

type CapturedAtomicQuery = {
  sql: string;
  params: unknown[];
};

type CapturedAtomicTransaction = {
  queries: CapturedAtomicQuery[];
  options: { isolationLevel?: string };
};

function createAtomicNeonHarness() {
  let storedManifest: string | null = null;
  let committed = {
    releases: 0,
    referenceSets: 0,
    parameters: 0,
    calculations: 0,
    components: 0,
    scores: 0,
    sources: 0,
  };
  const transactions: CapturedAtomicTransaction[] = [];
  const neonSql = {
    async transaction(
      build: (transaction: {
        query: (sql: string, params?: unknown[]) => CapturedAtomicQuery;
      }) => CapturedAtomicQuery[],
      options: { isolationLevel?: string } = {},
    ) {
      const queries: CapturedAtomicQuery[] = [];
      const planned = build({
        query(sql, params = []) {
          const query = { sql, params };
          queries.push(query);
          return query;
        },
      });
      assert.equal(planned.length, 2);
      transactions.push({ queries, options });

      const publish = queries[0];
      assert.ok(publish);
      const requestedManifest = String(publish.params[2]);
      const payload = JSON.parse(String(publish.params[3])) as {
        referenceSets: unknown[];
        parameters: unknown[];
        calculations: unknown[];
        components: unknown[];
        scores: unknown[];
        sourceIds: unknown[];
      };
      const isNew = storedManifest === null;
      if (isNew) {
        storedManifest = requestedManifest;
        committed = {
          releases: 1,
          referenceSets: payload.referenceSets.length,
          parameters: payload.parameters.length,
          calculations: payload.calculations.length,
          components: payload.components.length,
          scores: payload.scores.length,
          sources: payload.sourceIds.length,
        };
      }
      return [
        [{
          releases_written: isNew ? 1 : 0,
          reference_sets_written: isNew ? payload.referenceSets.length : 0,
          parameters_written: isNew ? payload.parameters.length : 0,
          calculations_written: isNew ? payload.calculations.length : 0,
          components_written: isNew ? payload.components.length : 0,
          scores_written: isNew ? payload.scores.length : 0,
          sources_stamped: isNew ? payload.sourceIds.length : 0,
        }],
        [{ manifest_sha256: storedManifest }],
      ];
    },
  } as never;
  return {
    neonSql,
    transactions,
    committed: () => ({ ...committed }),
  };
}

test("Neon Conditions plan gates the complete release and DB-clock freshness in one transaction batch", async () => {
  const first = row();
  const release = {
    releaseId: first.releaseId,
    methodologyVersion: first.methodologyVersion,
    referenceSets: buildFixedBoundReferenceSets({
      calculations: [first],
      componentId: "hdi",
      direction: "higher_is_better",
      transformationId: first.transformationId,
      lowerBound: 0,
      upperBound: 1,
    }),
  };
  const harness = createAtomicNeonHarness();
  assert.deepEqual(
    await writeConditionsRelease({} as never, release, [first], {
      neonSql: harness.neonSql,
    }),
    {
      proposed: 1,
      written: 1,
      calculationsWritten: 1,
      componentsWritten: 1,
    },
  );

  const transaction = harness.transactions[0];
  assert.equal(transaction.options.isolationLevel, "ReadCommitted");
  assert.equal(transaction.queries.length, 2);
  const publishSql = transaction.queries[0].sql;
  for (const table of [
    "civica_conditions_releases",
    "civica_conditions_reference_sets",
    "civica_conditions_normalization_parameters",
    "civica_conditions_calculations",
    "civica_conditions_components",
    "civica_conditions_scores",
  ]) {
    assert.ok(
      publishSql.includes(`INSERT INTO ${table}`),
      `atomic plan omits ${table}`,
    );
  }
  assert.equal(publishSql.match(/\bON CONFLICT\b/g)?.length, 1);
  assert.ok(publishSql.includes("ON CONFLICT (id) DO NOTHING"));
  assert.ok(publishSql.includes("inserted_release AS"));
  assert.ok(publishSql.includes("JOIN inserted_calculations"));
  assert.ok(publishSql.includes("inserted_source_rows AS"));
  assert.ok(publishSql.includes("stamped_sources AS"));
  assert.ok(publishSql.includes("inserted_release.created_at"));
  assert.ok(publishSql.includes("cardinality_guard"));
  for (const field of [
    "mean",
    '"standardDeviation"',
    '"lowerBound"',
    '"upperBound"',
    '"nativeValue"',
    '"normalizedScore"',
    '"rawValue"',
  ]) {
    assert.match(
      publishSql,
      new RegExp(`${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} double precision`),
      `atomic JSON ingress does not preserve double precision for ${field}`,
    );
  }
  assert.ok(
    transaction.queries[1].sql.includes("civica_conditions_releases"),
  );
  assert.equal(
    transaction.queries[0].params[2],
    conditionsReleaseManifestSha256(release, [first]),
  );

  const afterFirst = harness.committed();
  assert.deepEqual(
    await writeConditionsRelease({} as never, release, [first], {
      neonSql: harness.neonSql,
    }),
    {
      proposed: 1,
      written: 0,
      calculationsWritten: 0,
      componentsWritten: 0,
    },
  );
  assert.deepEqual(harness.committed(), afterFirst);

  await assert.rejects(
    writeConditionsRelease({} as never, release, [row(0.8)], {
      neonSql: harness.neonSql,
    }),
    /already exists with a different manifest/,
  );
  assert.deepEqual(harness.committed(), afterFirst);
  assert.equal(harness.transactions.length, 3);
});

test("atomic Conditions publish preserves economic decimals whose identity float32 would change", async () => {
  const database = await createDatabase();
  try {
    const releaseId = "conditions-economic-precision-v1";
    const exactInflation = 0.12345678901234566;
    const exactUnemployment = 7.987654321098765;
    const exactGrowth = -1.2345678901234567;
    const observations = [{
      jurisdictionId: "11111111-1111-4111-8111-111111111111",
      inflation: {
        value: exactInflation,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
      unemployment: {
        value: exactUnemployment,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
      gdpGrowth: {
        value: exactGrowth,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
    }];
    const calculations = buildEconomicConditionsCalculations({
      observations,
      releaseId,
      methodologyVersion: "conditions-components/v1",
      lineages: economicLineages(),
    });
    const float32Inflation = Math.fround(exactInflation);
    assert.notEqual(
      float32Inflation,
      exactInflation,
      "fixture must detect float32 precision loss",
    );
    const float32Calculations = buildEconomicConditionsCalculations({
      observations: [{
        ...observations[0],
        inflation: {
          ...observations[0].inflation,
          value: float32Inflation,
        },
      }],
      releaseId,
      methodologyVersion: "conditions-components/v1",
      lineages: economicLineages(),
    });
    assert.notEqual(
      float32Calculations[0].calculationKey,
      calculations[0].calculationKey,
      "float32 coercion must change the content-addressed calculation identity",
    );

    const release = {
      releaseId,
      methodologyVersion: "conditions-components/v1",
      referenceSets: buildEconomicReferenceSets(observations),
    };
    const first = await writeConditionsRelease(
      {} as never,
      release,
      calculations,
      { neonSql: pgliteAtomicNeonSql(database) },
    );
    assert.deepEqual(first, {
      proposed: 1,
      written: 0,
      calculationsWritten: 1,
      componentsWritten: 3,
    });

    const precisionColumns = (
      await database.query<{ tableName: string; columnName: string; dataType: string }>(`
        SELECT
          table_name AS "tableName",
          column_name AS "columnName",
          data_type AS "dataType"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'civica_conditions_normalization_parameters'
              AND column_name IN ('mean', 'standard_deviation', 'lower_bound', 'upper_bound'))
            OR (table_name = 'civica_conditions_scores'
              AND column_name IN ('normalized_score', 'raw_value'))
            OR (table_name = 'civica_conditions_components'
              AND column_name = 'native_value')
          )
        ORDER BY table_name, ordinal_position
      `)
    ).rows;
    assert.equal(precisionColumns.length, 7);
    assert.ok(
      precisionColumns.every((column) => column.dataType === "double precision"),
      JSON.stringify(precisionColumns),
    );

    const storedComponents = (
      await database.query<{ componentId: string; nativeValue: number }>(`
        SELECT
          component_id AS "componentId",
          native_value AS "nativeValue"
        FROM civica_conditions_components
        WHERE calculation_key = '${calculations[0].calculationKey}'
        ORDER BY component_id
      `)
    ).rows;
    assert.deepEqual(storedComponents, [
      { componentId: "gdp_growth", nativeValue: exactGrowth },
      { componentId: "inflation", nativeValue: exactInflation },
      { componentId: "unemployment", nativeValue: exactUnemployment },
    ]);
    const storedCalculation = (
      await database.query<{
        calculationKey: string;
        releaseId: string;
        jurisdictionId: string;
        dimension: ConditionScoreInput["dimension"];
        methodologyVersion: string;
        alignmentStatus: ConditionScoreInput["alignmentStatus"];
        referenceYear: number | null;
      }>(`
        SELECT
          calculation_key AS "calculationKey",
          release_id AS "releaseId",
          jurisdiction_id::text AS "jurisdictionId",
          dimension,
          methodology_version AS "methodologyVersion",
          alignment_status AS "alignmentStatus",
          reference_year AS "referenceYear"
        FROM civica_conditions_calculations
        WHERE calculation_key = '${calculations[0].calculationKey}'
      `)
    ).rows[0];
    assert.ok(storedCalculation);
    const storedNativeValues = new Map(
      storedComponents.map((component) => [
        component.componentId,
        component.nativeValue,
      ]),
    );
    assert.equal(
      conditionCalculationKey({
        ...storedCalculation,
        components: calculations[0].components.map((component) => ({
          ...component,
          nativeValue: storedNativeValues.get(component.componentId) ?? null,
        })),
      }),
      storedCalculation.calculationKey,
      "calculation identity must replay from stored double-precision values",
    );

    assert.deepEqual(
      await writeConditionsRelease({} as never, release, calculations, {
        neonSql: pgliteAtomicNeonSql(database),
      }),
      {
        proposed: 1,
        written: 0,
        calculationsWritten: 0,
        componentsWritten: 0,
      },
    );
    assert.deepEqual(
      (
        await database.query<{ componentId: string; nativeValue: number }>(`
          SELECT
            component_id AS "componentId",
            native_value AS "nativeValue"
          FROM civica_conditions_components
          WHERE calculation_key = '${calculations[0].calculationKey}'
          ORDER BY component_id
        `)
      ).rows,
      storedComponents,
    );
  } finally {
    await database.close();
  }
});

test("Neon Conditions transaction rolls back the header and freshness when a descendant insert fails", async () => {
  const database = await createDatabase();
  try {
    const first = row();
    const invalidBase = {
      ...first,
      components: [{
        ...first.components[0],
        sourceId: "missing_conditions_source",
      }],
    };
    const invalid = {
      ...invalidBase,
      calculationKey: conditionCalculationKey(invalidBase),
    };
    const release = {
      releaseId: invalid.releaseId,
      methodologyVersion: invalid.methodologyVersion,
      referenceSets: buildFixedBoundReferenceSets({
        calculations: [invalid],
        componentId: "hdi",
        direction: "higher_is_better",
        transformationId: invalid.transformationId,
        lowerBound: 0,
        upperBound: 1,
      }),
    };
    await assert.rejects(
      writeConditionsRelease({} as never, release, [invalid], {
        neonSql: pgliteAtomicNeonSql(database),
      }),
    );
    const state = (
      await database.query<{
        releases: number;
        referenceSets: number;
        parameters: number;
        calculations: number;
        components: number;
        scores: number;
        freshness: Date | null;
      }>(`
        SELECT
          (SELECT count(*)::int FROM civica_conditions_releases) AS releases,
          (SELECT count(*)::int FROM civica_conditions_reference_sets) AS "referenceSets",
          (SELECT count(*)::int FROM civica_conditions_normalization_parameters) AS parameters,
          (SELECT count(*)::int FROM civica_conditions_calculations) AS calculations,
          (SELECT count(*)::int FROM civica_conditions_components) AS components,
          (SELECT count(*)::int FROM civica_conditions_scores) AS scores,
          (SELECT last_sync_at FROM sources WHERE id = 'undp_hdi') AS freshness
      `)
    ).rows[0];
    assert.deepEqual(state, {
      releases: 0,
      referenceSets: 0,
      parameters: 0,
      calculations: 0,
      components: 0,
      scores: 0,
      freshness: null,
    });
  } finally {
    await database.close();
  }
});

test("Conditions release writer applies all three dimensions under one release, including not_ranked parameters", async () => {
  const database = await createDatabase();
  try {
    const db = drizzle(database);
    const releaseId = "conditions-combined-fixture-v1";
    const hdi = row(0.9, releaseId);
    const gpi = gpiRow(releaseId);
    const observations = [{
      jurisdictionId: hdi.jurisdictionId,
      inflation: {
        value: 5,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
      unemployment: {
        value: 8,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
      gdpGrowth: {
        value: 2,
        referenceYear: 2024,
        valueStatus: "observed" as const,
        valueStatusReason: null,
      },
    }];
    const economic = buildEconomicConditionsCalculations({
      observations,
      releaseId,
      methodologyVersion: hdi.methodologyVersion,
      lineages: economicLineages(),
    })[0];
    const release = {
      releaseId,
      methodologyVersion: hdi.methodologyVersion,
      referenceSets: [
        ...buildFixedBoundReferenceSets({
          calculations: [hdi],
          componentId: "hdi",
          direction: "higher_is_better",
          transformationId: hdi.transformationId,
          lowerBound: 0,
          upperBound: 1,
        }),
        ...buildFixedBoundReferenceSets({
          calculations: [gpi],
          componentId: "global_peace_index",
          direction: "lower_is_better",
          transformationId: gpi.transformationId,
          lowerBound: 1,
          upperBound: 5,
        }),
        ...buildEconomicReferenceSets(observations),
      ],
    };
    const calculations = [hdi, gpi, economic];

    const first = await writeConditionsRelease(
      db as never,
      release,
      calculations,
      { transactionMode: "drizzle-fixture" },
    );
    assert.deepEqual(first, {
      proposed: 3,
      written: 2,
      calculationsWritten: 3,
      componentsWritten: 5,
    });
    assert.equal(
      (
        await writeConditionsRelease(db as never, release, calculations, {
          transactionMode: "drizzle-fixture",
        })
      ).written,
      0,
    );
    const changedEconomic = buildEconomicConditionsCalculations({
      observations: [{
        ...observations[0],
        inflation: { ...observations[0].inflation, value: 6 },
      }],
      releaseId,
      methodologyVersion: hdi.methodologyVersion,
      lineages: economicLineages(),
    })[0];
    await assert.rejects(
      writeConditionsRelease(
        db as never,
        release,
        [hdi, gpi, changedEconomic],
        { transactionMode: "drizzle-fixture" },
      ),
      /already exists with a different manifest/,
    );
    assert.equal(
      (
        await database.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM civica_conditions_releases",
        )
      ).rows[0].count,
      1,
    );
    assert.deepEqual(
      (
        await database.query<{ direction: string }>(
          "SELECT DISTINCT direction FROM civica_conditions_normalization_parameters ORDER BY direction",
        )
      ).rows.map((record) => record.direction),
      ["higher_is_better", "lower_is_better", "not_ranked"],
    );
  } finally {
    await database.close();
  }
});
