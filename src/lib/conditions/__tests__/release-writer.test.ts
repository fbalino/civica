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
import { buildFixedBoundReferenceSets } from "../release";

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
  for (const path of ["0040_closed_young_avengers.sql", "0042_grey_sally_floyd.sql"]) {
    await database.exec(readFileSync(`drizzle/authoritative/${path}`, "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
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
    assert.equal((await writeConditionsRelease(db as never, release, [first])).written, 1);
    assert.equal((await writeConditionsRelease(db as never, release, [first])).written, 0);
    await assert.rejects(writeConditionsRelease(db as never, release, [row(0.8)]), /different manifest/);
    assert.equal((await database.query<{ count: number }>("SELECT count(*)::int AS count FROM civica_conditions_scores")).rows[0].count, 1);
  } finally { await database.close(); }
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
    );
    assert.deepEqual(first, {
      proposed: 3,
      written: 2,
      calculationsWritten: 3,
      componentsWritten: 5,
    });
    assert.equal(
      (await writeConditionsRelease(db as never, release, calculations)).written,
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
