import assert from "node:assert/strict";
import test from "node:test";

import {
  DEPLOYMENT_REHEARSAL_STEPS,
  deploymentRehearsalErrors,
  stagedMigrationCompatibilityErrors,
  type DeploymentRehearsalStep,
} from "./deployment-rehearsal";

test("canonical deployment rehearsal covers every required boundary in safe order", () => {
  assert.deepEqual(deploymentRehearsalErrors(), []);
  assert.ok(DEPLOYMENT_REHEARSAL_STEPS.some((step) => step.id === "stage-disable-jobs" && step.phase === "quiesce"));
  assert.ok(DEPLOYMENT_REHEARSAL_STEPS.some((step) => step.id === "recover-code-or-forward-fix" && step.scope === "recovery"));
});

test("reordered migration and deployment steps fail closed", () => {
  const reordered = [
    ...DEPLOYMENT_REHEARSAL_STEPS.filter((step) => step.id !== "stage-plan-and-migrate"),
    DEPLOYMENT_REHEARSAL_STEPS.find((step) => step.id === "stage-plan-and-migrate")!,
  ];
  const errors = deploymentRehearsalErrors(reordered);
  assert.ok(errors.some((error) => /stage-plan-and-migrate before stage-validate-release-data/.test(error)));
});

test("missing coverage and a destructive recovery policy fail closed", () => {
  const withoutSmoke = DEPLOYMENT_REHEARSAL_STEPS.map((step) =>
    step.covers.includes("smoke-tests")
      ? { ...step, covers: step.covers.filter((coverage) => coverage !== "smoke-tests") }
      : step,
  );
  const destructiveRecovery = withoutSmoke.map((step) =>
    step.id === "recover-code-or-forward-fix"
      ? { ...step, note: "Reverse the schema during rollback." }
      : step,
  ) as DeploymentRehearsalStep[];
  const errors = deploymentRehearsalErrors(destructiveRecovery);
  assert.ok(errors.some((error) => /does not cover smoke-tests/.test(error)));
  assert.ok(errors.some((error) => /must keep the additive schema/.test(error)));
});

test("migration compatibility allows old readers but rejects destructive DDL/data changes", () => {
  const source = {
    "0033_flat_hardball": "CREATE TABLE audit_log (id text);",
    "0034_superb_the_fallen": "CREATE TABLE executions (id text);",
    "0035_equal_marvex": "CREATE TABLE bindings (id text);",
    "0036_moaning_toad_men": `ALTER TABLE "ci_dimension_scores" ADD COLUMN "release_id" text; IF NEW.release_id IS NULL THEN RETURN NEW; END IF;`,
    "0037_minor_sharon_carter": "CREATE TABLE observations (id text);",
    "0038_heavy_slyde": "CREATE TABLE runs (id text);",
    "0039_living_clea": "CREATE TABLE events (id text);",
    "0040_closed_young_avengers": "CREATE TABLE conditions_components (id text); ALTER TABLE conditions_scores ADD COLUMN calculation_key text;",
    "0042_grey_sally_floyd": "CREATE TABLE conditions_releases (id text); ALTER TABLE conditions_scores ADD COLUMN release_id text;",
    "0043_pulse_decay_lifecycle": "CREATE TABLE pulse_decay_recomputations (id text);",
    "0044_pulse_drift_monitoring": "CREATE TABLE pulse_drift_runs (id text);",
    "0045_pulse_evaluation_workspace_reconciliation": "CREATE TABLE pulse_evaluation_workspace_reconciliations (id text);",
    "0046_little_mulholland_black": "CREATE TABLE atlas_entity_change_history (id text);",
    "0047_atlas_data_error_reports": "ALTER TABLE correction_log ADD COLUMN entity_type text;",
    "0048_entity_name_forms": "CREATE TABLE entity_name_forms (id text);",
    "0049_curvy_shen": "ALTER TABLE civica_conditions_scores ALTER COLUMN normalized_score SET DATA TYPE double precision;",
    "0050_index_release_header_contract": "UPDATE ci_index_releases SET input_manifest_sha256 = 'checked';",
    "0051_eminent_jocasta": "ALTER TABLE conditions_reference_sets DROP CONSTRAINT conditions_reference_sets_direction_check; ALTER TABLE conditions_reference_sets ADD CONSTRAINT conditions_reference_sets_direction_check CHECK (direction IN ('higher_is_better', 'lower_is_better', 'not_ranked'));",
  };
  assert.deepEqual(stagedMigrationCompatibilityErrors(source), []);
  assert.ok(stagedMigrationCompatibilityErrors({ ...source, "0038_heavy_slyde": "DROP TABLE production_pipeline_runs;" }).some((error) => /drops a table/.test(error)));
  assert.ok(stagedMigrationCompatibilityErrors({ ...source, "0036_moaning_toad_men": `ALTER TABLE "ci_dimension_scores" ADD COLUMN "release_id" text NOT NULL; IF NEW.release_id IS NULL THEN RETURN NEW; END IF;` }).some((error) => /not reader-compatible/.test(error)));
});
