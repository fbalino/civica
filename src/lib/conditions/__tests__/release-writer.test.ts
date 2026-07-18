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
import { writeConditionsRelease } from "../ingest";
import { buildFixedBoundReferenceSets } from "../release";

function row(rawValue = 0.9): ConditionScoreInput {
  const base = {
    releaseId: "conditions-hdi-fixture-v1",
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

test("Conditions release writer commits one immutable release and rejects a changed rerun", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE sources (id text PRIMARY KEY, last_sync_at timestamp);
      CREATE TABLE jurisdictions (id uuid PRIMARY KEY);
      INSERT INTO sources (id) VALUES ('undp_hdi');
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
