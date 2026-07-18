import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("ATL-026/ATL-027 authoritative migrations apply the decomposable and frozen Conditions ledgers", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE sources (id text PRIMARY KEY);
      CREATE TABLE jurisdictions (id uuid PRIMARY KEY);
      CREATE TABLE civica_conditions_scores (
        id uuid PRIMARY KEY,
        jurisdiction_id uuid NOT NULL,
        dimension text NOT NULL,
        quarter text NOT NULL,
        normalized_score real NOT NULL,
        raw_value real,
        source_id text NOT NULL,
        indicator_id text NOT NULL,
        upstream_release text NOT NULL,
        artifact_hash text NOT NULL,
        artifact_kind text NOT NULL,
        temporal_coverage text NOT NULL,
        license_url text NOT NULL,
        transformation_id text NOT NULL,
        substitution_reason text,
        method_version text NOT NULL,
        dataset_year integer NOT NULL,
        methodology_version text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX idx_conditions_unique ON civica_conditions_scores
        (jurisdiction_id, dimension, quarter, methodology_version, source_id, indicator_id);
      CREATE FUNCTION civica_capture_research_evidence_history()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
    `);

    const migration = readFileSync(
      "drizzle/authoritative/0040_closed_young_avengers.sql",
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(migration);
    const releaseMigration = readFileSync(
      "drizzle/authoritative/0042_grey_sally_floyd.sql",
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(releaseMigration);

    const [relations] = await database.query<{
      calculation: string | null;
      component: string | null;
      release: string | null;
      referenceSet: string | null;
      parameter: string | null;
      scoreKey: boolean;
      releaseKey: boolean;
    }>(`
      SELECT
        to_regclass('public.civica_conditions_calculations')::text AS calculation,
        to_regclass('public.civica_conditions_components')::text AS component,
        to_regclass('public.civica_conditions_releases')::text AS release,
        to_regclass('public.civica_conditions_reference_sets')::text AS "referenceSet",
        to_regclass('public.civica_conditions_normalization_parameters')::text AS parameter,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'civica_conditions_scores'
            AND column_name = 'calculation_key'
        ) AS "scoreKey",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'civica_conditions_scores'
            AND column_name = 'release_id'
        ) AS "releaseKey"
    `).then((result) => result.rows);

    assert.equal(relations?.calculation, "civica_conditions_calculations");
    assert.equal(relations?.component, "civica_conditions_components");
    assert.equal(relations?.release, "civica_conditions_releases");
    assert.equal(relations?.referenceSet, "civica_conditions_reference_sets");
    assert.equal(relations?.parameter, "civica_conditions_normalization_parameters");
    assert.equal(relations?.scoreKey, true);
    assert.equal(relations?.releaseKey, true);
  } finally {
    await database.close();
  }
});
