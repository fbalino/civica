import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { splitPostgresStatements } from "../src/lib/db/authoritative-migrations";
import {
  checkedReleaseArtifactErrors,
  RELEASE_MIGRATION_PATH,
  releaseMigrationSourceErrors,
  releasePackageScriptErrors,
  releasePublicationScriptErrors,
} from "./validate-release-consistency";

const validMigration = `
CREATE TABLE "ci_index_releases"();
CREATE TABLE "ci_index_release_pointers"();
ALTER TABLE "ci_dimension_scores" ADD COLUMN "release_id" text;
ALTER TABLE "ci_composite_scores" ADD COLUMN "release_id" text;
"methodology_content_sha256" text NOT NULL
"supersession_kind" text NOT NULL
"uncertainty_policy" jsonb NOT NULL
"dimension_rules" jsonb NOT NULL
legacy_unregistered_vintage
ci-composite/fixed-bounds-monte-carlo-v2
ci-composite/fixed-bounds-weighted-v3
UNIQUE NULLS NOT DISTINCT
ci_index_releases_identity_shape
ci_index_releases_source_artifacts_shape
ci_index_releases_supersession_shape
ci_index_releases_uncertainty_shape
ci_index_releases_dimension_rules_shape
civica_ci_methodology_content_sha256
civica_ci_source_basket_version
civica_ci_expected_derivation_envelope
civica_ci_expected_derivation_version_key
civica_validate_ci_release_score_row
civica_guard_published_ci_score_mutation
civica_guard_ci_release_header_mutation
must be inserted as staging
BEFORE INSERT OR UPDATE OR DELETE ON ci_index_releases
civica_guard_published_ci_methodology
civica_ci_dimension_storage_sha256
civica_ci_composite_storage_sha256
civica_validate_ci_release_pointer
civica_guard_ci_release_pointer_delete
verified_input_manifest_sha256 text
verified_dimension_row_set_sha256 text
verified_composite_row_set_sha256 text
observed_dimension_storage_sha256 text
observed_composite_storage_sha256 text
LOCK TABLE ci_dimension_scores IN SHARE MODE
LOCK TABLE ci_composite_scores IN SHARE MODE
changed after semantic verification
Index pointer must flip through civica_publish_ci_release()
Index publication pointer cannot be deleted
actual_methodology_content_sha256
actual_source_artifacts
jsonb_array_elements(release_row.dimension_rules)
rule->>'upstreamRelease'=score.upstream_release
rule->>'substitutionReason' IS NOT DISTINCT FROM score.substitution_reason
score.supersedes_vintage_label IS DISTINCT FROM release_row.supersedes_vintage_label
count(*)=count(DISTINCT history.jurisdiction_id)*5
history_count<>jurisdiction_count*5
CREATE OR REPLACE FUNCTION civica_guard_published_pulse_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_run_id uuid; new_run_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pulse_pipeline_runs run
    WHERE (run.id=old_run_id OR run.id=new_run_id)
      AND run.stage='score'
      AND run.status='completed'
  ) THEN
    RAISE EXCEPTION 'completed Pulse score history is immutable';
  END IF;
  RETURN NEW;
END $$;
civica_guard_published_pulse_run
civica_guard_pulse_publication_pointer_delete
LOCK TABLE pulse_dimensional_delta_history IN SHARE MODE
Deliberately no automatic publication here
-- civica-affected-relations: ci_index_releases
`;

test("all checked Index reproduction artifacts agree with the release registry", () => {
  assert.deepEqual(checkedReleaseArtifactErrors(), []);
});

test("migration validation rejects count-only and one-argument publication", () => {
  assert.deepEqual(releaseMigrationSourceErrors(validMigration), []);
  const automatic = `${validMigration}\nDO $$ BEGIN PERFORM civica_publish_ci_release(release_id); END $$;`;
  assert.ok(
    releaseMigrationSourceErrors(automatic).includes(
      "migration auto-publishes without the checked semantic gate",
    ),
  );
  assert.ok(
    releaseMigrationSourceErrors(
      `${validMigration}\nCREATE FUNCTION civica_publish_ci_release(target_release_id text) RETURNS void;`,
    ).includes("publication function still accepts a release ID alone"),
  );
  assert.ok(
    releaseMigrationSourceErrors(
      validMigration.replace(
        "LOCK TABLE ci_composite_scores IN SHARE MODE",
        "",
      ),
    ).some((error) => error.includes("LOCK TABLE ci_composite_scores")),
  );
});

test("publication validation requires explicit modes, both hashes, and no secret logging", () => {
  const valid = `
type Mode = "stage" | "check" | "publish";
ciReproductionManifestErrors; ciPublicationInventoryErrors; ciStagedReleaseHeader; ciMethodologyContentSha256;
CI_TARGET_RELEASE_ID; civica_ci_dimension_storage_sha256; civica_ci_composite_storage_sha256;
civica_publish_ci_release; dimensionStorageSha256; compositeStorageSha256;
methodology_content_sha256; supersession_kind; uncertainty_policy; dimension_rules; dimensionRules;
throw new Error("Choose exactly one mode");
`;
  assert.deepEqual(releasePublicationScriptErrors(valid), []);
  assert.ok(
    releasePublicationScriptErrors(
      `${valid}\nconsole.log(process.env.DATABASE_URL);`,
    ).includes("publication script may print environment or database secrets"),
  );
  assert.ok(
    releasePublicationScriptErrors(
      valid.replace("compositeStorageSha256", ""),
    ).some((error) => error.includes("compositeStorageSha256")),
  );
});

test("migration validation requires complete Pulse panels and immutable publication evidence", () => {
  assert.ok(
    releaseMigrationSourceErrors(
      validMigration.replace(
        "history_count<>jurisdiction_count*5",
        "",
      ),
    ).some((error) => error.includes("history_count<>jurisdiction_count*5")),
  );
  assert.ok(
    releaseMigrationSourceErrors(
      validMigration.replace("civica_guard_published_pulse_history", ""),
    ).some((error) => error.includes("civica_guard_published_pulse_history")),
  );
  assert.ok(
    releaseMigrationSourceErrors(
      validMigration.replace("run.status='completed'", "run.status='running'"),
    ).some((error) => error.includes("run.status='completed'")),
  );
  assert.ok(
    releaseMigrationSourceErrors(
      validMigration.replace(
        "SELECT 1 FROM pulse_pipeline_runs run",
        "SELECT 1 FROM pulse_score_publication_pointers pointer",
      ),
    ).some((error) => error.includes("current publication pointer moves")),
  );
});

test("a superseded Pulse publication cannot accept late history rows", async () => {
  const migration = readFileSync(RELEASE_MIGRATION_PATH, "utf8");
  const statements = splitPostgresStatements(migration);
  const requiredStatements = [
    "CREATE OR REPLACE FUNCTION civica_validate_pulse_score_publication()",
    "CREATE TRIGGER plt_014_validate_pulse_score_publication",
    "CREATE OR REPLACE FUNCTION civica_guard_published_pulse_history()",
    "CREATE TRIGGER plt_014_guard_published_pulse_history",
  ].map((token) => {
    const statement = statements.find((candidate) => candidate.includes(token));
    assert.ok(statement, `migration statement is missing: ${token}`);
    return statement;
  });
  const database = new PGlite();
  const runA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const runB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const jurisdictionA = "11111111-1111-4111-8111-111111111111";
  const jurisdictionB = "22222222-2222-4222-8222-222222222222";
  const lateJurisdiction = "33333333-3333-4333-8333-333333333333";
  const versionA = `pulse-stage/sha256:${"a".repeat(64)}`;
  const versionB = `pulse-stage/sha256:${"b".repeat(64)}`;
  const dimensions = [
    "democratic_quality",
    "rule_of_law",
    "freedom_rights",
    "corruption_control",
    "stability",
  ];

  try {
    await database.exec(`
      CREATE TABLE pulse_pipeline_runs (
        id uuid PRIMARY KEY,
        stage text NOT NULL,
        status text NOT NULL,
        version_key text NOT NULL,
        failures jsonb NOT NULL DEFAULT '[]'::jsonb,
        completed_at timestamp
      );
      CREATE TABLE pulse_dimensional_delta_history (
        computation_run_id uuid NOT NULL,
        jurisdiction_id uuid NOT NULL,
        dimension text NOT NULL,
        score_as_of date NOT NULL,
        UNIQUE (computation_run_id, jurisdiction_id, dimension)
      );
      CREATE TABLE pulse_score_publication_pointers (
        product text PRIMARY KEY,
        computation_run_id uuid NOT NULL UNIQUE,
        version_key text NOT NULL,
        score_as_of date NOT NULL,
        published_at timestamp NOT NULL
      );
    `);
    for (const statement of requiredStatements) await database.exec(statement);

    for (const [runId, versionKey, jurisdictionId, day] of [
      [runA, versionA, jurisdictionA, "2026-07-14"],
      [runB, versionB, jurisdictionB, "2026-07-15"],
    ] as const) {
      await database.query(
        `INSERT INTO pulse_pipeline_runs
          (id,stage,status,version_key,failures,completed_at)
         VALUES ($1,'score','running',$2,'[]'::jsonb,NULL)`,
        [runId, versionKey],
      );
      for (const dimension of dimensions) {
        await database.query(
          `INSERT INTO pulse_dimensional_delta_history
            (computation_run_id,jurisdiction_id,dimension,score_as_of)
           VALUES ($1,$2,$3,$4)`,
          [runId, jurisdictionId, dimension, day],
        );
      }
      await database.query(
        `UPDATE pulse_pipeline_runs
         SET status='completed',completed_at=$2
         WHERE id=$1`,
        [runId, `${day}T12:00:00.000Z`],
      );
      await database.query(
        `INSERT INTO pulse_score_publication_pointers
          (product,computation_run_id,version_key,score_as_of,published_at)
         VALUES ('pulse_dimensions',$1,$2,$3,$4)
         ON CONFLICT (product) DO UPDATE SET
           computation_run_id=EXCLUDED.computation_run_id,
           version_key=EXCLUDED.version_key,
           score_as_of=EXCLUDED.score_as_of,
           published_at=EXCLUDED.published_at`,
        [runId, versionKey, day, `${day}T12:00:00.000Z`],
      );
    }

    await assert.rejects(
      database.query(
        `INSERT INTO pulse_dimensional_delta_history
          (computation_run_id,jurisdiction_id,dimension,score_as_of)
         VALUES ($1,$2,'stability','2026-07-14')`,
        [runA, lateJurisdiction],
      ),
      /completed Pulse score history is immutable/,
    );
    const result = await database.query<{ count: number }>(
      `SELECT count(*)::integer AS count
       FROM pulse_dimensional_delta_history
       WHERE computation_run_id=$1`,
      [runA],
    );
    assert.equal(result.rows[0]?.count, 5);
  } finally {
    await database.close();
  }
});

test("package validation closes stage, check, publish, validator, and build wiring", () => {
  const scripts = {
    "stage:ci-release": "tsx scripts/publish-ci-release.ts --stage",
    "check:ci-release": "tsx scripts/publish-ci-release.ts --check",
    "publish:ci-release": "tsx scripts/publish-ci-release.ts --publish",
    "validate:release-consistency":
      "node --import tsx --test src/lib/ci/release-publication.test.ts src/lib/exports/atlas-release.test.ts src/lib/pulse/v2/publication-consistency.test.ts scripts/validate-release-consistency.test.ts && tsx scripts/validate-release-consistency.ts && npm run validate:deployment-rehearsal",
    "build:core": "npm run validate:release-consistency && next build",
  };
  assert.deepEqual(releasePackageScriptErrors(scripts), []);
  assert.ok(
    releasePackageScriptErrors({
      ...scripts,
      "publish:ci-release": "tsx scripts/publish-ci-release.ts",
    }).some((error) => error.includes("publish:ci-release")),
  );
  assert.ok(
    releasePackageScriptErrors({ ...scripts, "build:core": "next build" }).includes(
      "build:core omits validate:release-consistency",
    ),
  );
});
