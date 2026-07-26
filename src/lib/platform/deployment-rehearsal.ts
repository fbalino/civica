/**
 * PLT-019 — closed ordering contract for an owner-operated deployment.
 *
 * Database migration is intentionally outside a Vercel build. A build may run
 * for a preview and is not an operator's acknowledgement that a shared schema
 * may change. The target database is migrated explicitly, after a zero-write
 * plan and before the candidate application is promoted.
 */
export const DEPLOYMENT_REHEARSAL_SCHEMA_VERSION =
  "civica-deployment-rehearsal/v1" as const;

export const STAGED_MIGRATION_IDS = [
  "0033_flat_hardball",
  "0034_superb_the_fallen",
  "0035_equal_marvex",
  "0036_moaning_toad_men",
  "0037_minor_sharon_carter",
  "0038_heavy_slyde",
  "0039_living_clea",
  "0040_closed_young_avengers",
  "0042_grey_sally_floyd",
  "0043_pulse_decay_lifecycle",
  "0044_pulse_drift_monitoring",
  "0045_pulse_evaluation_workspace_reconciliation",
  "0046_little_mulholland_black",
  "0047_atlas_data_error_reports",
  "0048_entity_name_forms",
  "0049_curvy_shen",
] as const;

export type DeploymentScope = "staging" | "production" | "recovery";
export type DeploymentPhase =
  | "prepare"
  | "quiesce"
  | "migrate"
  | "release"
  | "deploy"
  | "smoke"
  | "resume"
  | "recover";

export type RehearsalCoverage =
  | "compatible-schema"
  | "jobs"
  | "caches"
  | "static-assets"
  | "release-metadata"
  | "smoke-tests"
  | "abort-points"
  | "rollback"
  | "forward-fix"
  | "old-reader-compatibility";

export interface DeploymentRehearsalStep {
  id: string;
  scope: DeploymentScope;
  phase: DeploymentPhase;
  covers: readonly RehearsalCoverage[];
  requiredBefore: readonly string[];
  abort: string | null;
  note: string;
}

const REQUIRED_COVERAGE: readonly RehearsalCoverage[] = [
  "compatible-schema",
  "jobs",
  "caches",
  "static-assets",
  "release-metadata",
  "smoke-tests",
  "abort-points",
  "rollback",
  "forward-fix",
  "old-reader-compatibility",
];

/**
 * This is deliberately a single serial sequence. The staging steps exercise
 * the exact migration and public data boundaries first; production repeats the
 * proven order only after its jobs are quiet. A recovery step is rehearsed but
 * never treated as a reason to reverse evidence-bearing production DDL.
 */
export const DEPLOYMENT_REHEARSAL_STEPS: readonly DeploymentRehearsalStep[] =
  Object.freeze([
    {
      id: "stage-capture-candidate",
      scope: "staging",
      phase: "prepare",
      covers: ["release-metadata", "static-assets", "caches", "abort-points"],
      requiredBefore: [],
      abort: "Stop if the candidate commit, migration manifest, checked artifacts, or release identities are not fixed together.",
      note: "Record commit, deployment URL, source-map release identity, immutable release URLs, and cache profile report; never overwrite a frozen release URL.",
    },
    {
      id: "stage-create-isolated-neon-branch",
      scope: "staging",
      phase: "prepare",
      covers: ["compatible-schema", "rollback"],
      requiredBefore: ["stage-capture-candidate"],
      abort: "Stop if the staging connection does not point to a disposable child branch of the recorded production state.",
      note: "Use a time-limited Neon child branch with its own Vercel environment; it must never share production DATABASE_URL.",
    },
    {
      id: "stage-disable-jobs",
      scope: "staging",
      phase: "quiesce",
      covers: ["jobs", "abort-points"],
      requiredBefore: ["stage-create-isolated-neon-branch"],
      abort: "Stop if any staging cron remains enabled or a prior staging job still holds a lease.",
      note: "Disable Vercel Cron Jobs in the staging project before migration; a deployment does not interrupt an already running cron invocation.",
    },
    {
      id: "stage-plan-and-migrate",
      scope: "staging",
      phase: "migrate",
      covers: ["compatible-schema", "old-reader-compatibility", "abort-points"],
      requiredBefore: ["stage-disable-jobs"],
      abort: "Stop before any app deployment if the zero-write plan, migration ledger, or post-apply fingerprint differs from the checked contract.",
      note: "Run db:plan, then db:migrate once, then validate the live authoritative ledger and fingerprint. Old reader code may read this additive schema; legacy writers remain quiesced.",
    },
    {
      id: "stage-validate-release-data",
      scope: "staging",
      phase: "release",
      covers: ["release-metadata", "caches", "abort-points", "forward-fix"],
      requiredBefore: ["stage-plan-and-migrate"],
      abort: "Stop before deployment if Index reproduction or pointer checks, Pulse complete-run checks, source-input hashes, or release-quality checks fail.",
      note: "Stage, check, and publish only verified release metadata in predecessor order. Corrections use a successor release, never a mutable cached vintage.",
    },
    {
      id: "stage-deploy-candidate",
      scope: "staging",
      phase: "deploy",
      covers: ["static-assets", "caches", "old-reader-compatibility"],
      requiredBefore: ["stage-validate-release-data"],
      abort: "Stop if the deployed build identity, static artifact hashes, or immutable release URL headers differ from the recorded candidate.",
      note: "The Vercel build validates only; it must not run db:migrate. Public live data remains no-store and checked artifacts revalidate rather than serve false freshness.",
    },
    {
      id: "stage-smoke",
      scope: "staging",
      phase: "smoke",
      covers: ["smoke-tests", "jobs", "release-metadata", "abort-points"],
      requiredBefore: ["stage-deploy-candidate"],
      abort: "Do not promote the candidate if a representative Atlas read, Index release read, Pulse publication read, protected error path, or safe cron dry run fails.",
      note: "Use request-safe reader smoke checks and one idempotent dry run; confirm no staging source freshness advances during the dry run.",
    },
    {
      id: "production-capture-and-quiesce",
      scope: "production",
      phase: "quiesce",
      covers: ["jobs", "rollback", "abort-points"],
      requiredBefore: ["stage-smoke"],
      abort: "Stop if the known-good deployment/release coordinates are not recorded, Cron Jobs cannot be disabled, or existing leases have not reached a terminal state.",
      note: "Record the rollback-eligible production deployment, then manually disable production Cron Jobs and wait for or inspect active leases before schema work.",
    },
    {
      id: "production-plan-and-migrate",
      scope: "production",
      phase: "migrate",
      covers: ["compatible-schema", "old-reader-compatibility", "abort-points"],
      requiredBefore: ["production-capture-and-quiesce"],
      abort: "Stop before release publication or application deployment if the live plan, applied migration hashes, or final schema fingerprint disagree.",
      note: "Run the same explicit pre-deploy migration sequence proved on staging. Keep the additive schema when recovering code; never infer a destructive rollback.",
    },
    {
      id: "production-publish-release-metadata",
      scope: "production",
      phase: "release",
      covers: ["release-metadata", "forward-fix", "caches"],
      requiredBefore: ["production-plan-and-migrate"],
      abort: "Stop if the semantic verification, pointer transaction, or immutable release identity cannot be reproduced exactly.",
      note: "Publish only the staged, checked release sequence. Release and pointer corrections are forward-only successors.",
    },
    {
      id: "production-promote-candidate",
      scope: "production",
      phase: "deploy",
      covers: ["static-assets", "caches", "old-reader-compatibility"],
      requiredBefore: ["production-publish-release-metadata"],
      abort: "Stop if the promoted production build does not match the staged commit, validated assets, or configured environment identity.",
      note: "Promote the already-rehearsed candidate only after explicit migration and release checks; deployment itself is validation-only.",
    },
    {
      id: "production-smoke-and-resume",
      scope: "production",
      phase: "resume",
      covers: ["smoke-tests", "jobs", "abort-points"],
      requiredBefore: ["production-promote-candidate"],
      abort: "Keep Cron Jobs disabled and begin recovery if public smoke checks, deployment logs, source-map identity, or a bounded job dry run fail.",
      note: "Run production-safe smoke checks before manually re-enabling Cron Jobs; record only IDs, timestamps, and bounded outcomes.",
    },
    {
      id: "recover-code-or-forward-fix",
      scope: "recovery",
      phase: "recover",
      covers: ["rollback", "forward-fix", "jobs", "old-reader-compatibility"],
      requiredBefore: ["production-promote-candidate"],
      abort: null,
      note: "Disable Cron Jobs manually, use Vercel Instant Rollback only for compatible reader code, keep the additive schema, and forward-fix data or schema. Re-enable jobs only after the selected code version is safe to write.",
    },
  ]);

function indexOfStep(steps: readonly DeploymentRehearsalStep[], id: string) {
  return steps.findIndex((step) => step.id === id);
}

/** Reject an incomplete or reordered procedure before it can become a runbook. */
export function deploymentRehearsalErrors(
  steps: readonly DeploymentRehearsalStep[] = DEPLOYMENT_REHEARSAL_STEPS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const covered = new Set<RehearsalCoverage>();
  for (const step of steps) {
    if (!step.id || ids.has(step.id)) errors.push(`duplicate or empty step id: ${step.id}`);
    ids.add(step.id);
    if (!step.note.trim()) errors.push(`${step.id}: note is required`);
    if (step.abort !== null && !step.abort.trim()) errors.push(`${step.id}: abort point is empty`);
    for (const coverage of step.covers) covered.add(coverage);
    for (const required of step.requiredBefore) {
      if (!ids.has(required)) {
        errors.push(`${step.id}: prerequisite ${required} is missing or comes after it`);
      }
    }
  }
  for (const coverage of REQUIRED_COVERAGE) {
    if (!covered.has(coverage)) errors.push(`rehearsal does not cover ${coverage}`);
  }
  const ordered = [
    ["stage-create-isolated-neon-branch", "stage-disable-jobs"],
    ["stage-disable-jobs", "stage-plan-and-migrate"],
    ["stage-plan-and-migrate", "stage-validate-release-data"],
    ["stage-validate-release-data", "stage-deploy-candidate"],
    ["stage-deploy-candidate", "stage-smoke"],
    ["stage-smoke", "production-capture-and-quiesce"],
    ["production-capture-and-quiesce", "production-plan-and-migrate"],
    ["production-plan-and-migrate", "production-publish-release-metadata"],
    ["production-publish-release-metadata", "production-promote-candidate"],
    ["production-promote-candidate", "production-smoke-and-resume"],
  ] as const;
  for (const [before, after] of ordered) {
    const beforeIndex = indexOfStep(steps, before);
    const afterIndex = indexOfStep(steps, after);
    if (beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex) {
      errors.push(`rehearsal ordering must keep ${before} before ${after}`);
    }
  }
  const recovery = steps.find((step) => step.id === "recover-code-or-forward-fix");
  if (!recovery?.note.includes("keep the additive schema")) {
    errors.push("recovery must keep the additive schema during a code rollback");
  }
  return errors;
}

/**
 * Reader compatibility is deliberately narrower than writer compatibility.
 * The PLT-014 release migration leaves old columns readable but adds release
 * validation for named scores, so old writers must remain stopped once the
 * schema is applied. This is the safety condition used for code rollback.
 */
export function stagedMigrationCompatibilityErrors(
  migrationSources: Readonly<Record<(typeof STAGED_MIGRATION_IDS)[number], string>>,
): string[] {
  const errors: string[] = [];
  for (const id of STAGED_MIGRATION_IDS) {
    const source = migrationSources[id];
    if (!source) {
      errors.push(`${id}: migration source is unavailable`);
      continue;
    }
    if (/\bDROP\s+TABLE\b/i.test(source)) errors.push(`${id}: drops a table`);
    if (/\bDROP\s+COLUMN\b/i.test(source)) errors.push(`${id}: drops a column`);
    if (/^\s*TRUNCATE\s+/im.test(source)) errors.push(`${id}: truncates data`);
    if (/\bDELETE\s+FROM\b/i.test(source)) errors.push(`${id}: deletes data`);
  }
  const releaseMigration = migrationSources["0036_moaning_toad_men"];
  if (releaseMigration) {
    for (const token of [
      'ADD COLUMN "release_id" text',
      "IF NEW.release_id IS NULL",
      "RETURN NEW",
    ]) {
      if (!releaseMigration.includes(token)) {
        errors.push(`0036_moaning_toad_men: missing read-compatible release-id behavior (${token})`);
      }
    }
    if (/ADD\s+COLUMN\s+"release_id"\s+text\s+NOT\s+NULL/i.test(releaseMigration)) {
      errors.push("0036_moaning_toad_men: release_id is not reader-compatible");
    }
  }
  return errors;
}
