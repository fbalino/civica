import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

test("ATL-026 authoritative migration applies its additive Conditions ledger", async () => {
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
      CREATE FUNCTION civica_capture_research_evidence_history()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
    `);

    const migration = readFileSync(
      "drizzle/authoritative/0040_closed_young_avengers.sql",
      "utf8",
    ).replaceAll("--> statement-breakpoint", "");
    await database.exec(migration);

    const [relations] = await database.query<{
      calculation: string | null;
      component: string | null;
      scoreKey: boolean;
    }>(`
      SELECT
        to_regclass('public.civica_conditions_calculations')::text AS calculation,
        to_regclass('public.civica_conditions_components')::text AS component,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'civica_conditions_scores'
            AND column_name = 'calculation_key'
        ) AS "scoreKey"
    `).then((result) => result.rows);

    assert.equal(relations?.calculation, "civica_conditions_calculations");
    assert.equal(relations?.component, "civica_conditions_components");
    assert.equal(relations?.scoreKey, true);
  } finally {
    await database.close();
  }
});
