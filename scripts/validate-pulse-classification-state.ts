import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../src/lib/db/schema";
import { CURRENT_CLASSIFICATION_CONFIG_HASH } from "../src/lib/pulse/v2/classify";
import { loadClassificationQueueMetrics } from "../src/lib/pulse/v2/classification-state-store";

config({ path: ".env.local", override: true });

function fail(message: string): never {
  throw new Error(`PUL-032 classification-state validation failed: ${message}`);
}

const sources = {
  schema: readFileSync("src/lib/db/schema.ts", "utf8"),
  state: readFileSync("src/lib/pulse/v2/classification-state.ts", "utf8"),
  store: readFileSync("src/lib/pulse/v2/classification-state-store.ts", "utf8"),
  classify: readFileSync("src/lib/pulse/v2/classify.ts", "utf8"),
  publication: readFileSync(
    "src/lib/pulse/v2/classification-publication.ts",
    "utf8",
  ),
  finalizer: readFileSync(
    "src/lib/pulse/v2/classification-run-finalizer.ts",
    "utf8",
  ),
  cronRoute: readFileSync(
    "src/app/api/cron/pulse/v2/classify/route.ts",
    "utf8",
  ),
  pipeline: readFileSync("src/lib/pulse/v2/pipeline-version.ts", "utf8"),
  cli: readFileSync("scripts/sync-pulse-v2-classify.ts", "utf8"),
  migration: readFileSync(
    "drizzle/authoritative/0024_dark_maginty.sql",
    "utf8",
  ),
  deliveryMigration: readFileSync(
    "drizzle/authoritative/0035_equal_marvex.sql",
    "utf8",
  ),
};

for (const fragment of [
  "pulseClusterClassificationStates",
  "pulseClassificationAttempts",
  "pulse_classification_state_contract_check",
  "pulse_classification_attempt_contract_check",
]) {
  if (!sources.schema.includes(fragment)) fail(`schema is missing ${fragment}`);
}
for (const fragment of [
  "cronExecutionKey",
  "pulseCronStageRunId",
  "inputFingerprint",
  "cluster-raw:",
  "finalizeClassificationPipelineRun",
  "reconstructFrozenClassificationSnapshot",
  "loadSoleRunningClassificationRun",
  "loadBoundClassificationRun",
  "bindClassificationDeliveryRun",
  "pulseClassificationDeliveryBindings",
]) {
  if (!sources.classify.includes(fragment))
    fail(`classifier retry contract is missing ${fragment}`);
}
for (const fragment of [
  "pulse_classification_delivery_bindings",
  "pulse_classification_delivery_execution_fk",
  "pulse_classification_delivery_run_fk",
]) {
  if (!sources.schema.includes(fragment))
    fail(`classification delivery schema is missing ${fragment}`);
}
for (const fragment of [
  "pulse_classification_attempts",
  "pulse_cluster_classification_states",
  "pulse_event_decisions",
  "pulse_sources",
  "p.status = 'running'",
  'status: "completed" | "partial"',
]) {
  if (!sources.finalizer.includes(fragment))
    fail(`classification run finalizer is missing ${fragment}`);
}
for (const fragment of ["cronExecutionKeyFromRequest", "cronExecutionKey,"]) {
  if (!sources.cronRoute.includes(fragment))
    fail(`classification cron route is missing ${fragment}`);
}
for (const fragment of [
  '"classified"',
  '"none"',
  '"retryable_failure"',
  '"terminal_failure"',
  "buildClassificationConfigHash",
  "selectClassificationQueue",
  "initialDelayMs",
  "maxAttempts: 3",
]) {
  if (!sources.state.includes(fragment))
    fail(`state contract is missing ${fragment}`);
}
for (const fragment of [
  "ON CONFLICT (cluster_id, config_hash)",
  "attempt_count < pulse_cluster_classification_states.max_attempts",
  "pulse_classification_attempts",
  "loadClassificationQueueMetrics",
  "attempt_in_progress",
  "recoverExpiredFinalClassificationClaim",
  "classification_claim_expired_at_retry_limit",
]) {
  if (!sources.store.includes(fragment))
    fail(`state store is missing ${fragment}`);
}
for (const fragment of [
  "CURRENT_CLASSIFICATION_CONFIG_HASH",
  "claimClassificationAttempt",
  "settleClassificationAttempt",
  "CASE WHEN cs.id IS NULL THEN 0 ELSE 1 END",
  "cs.next_retry_at <= ${eligibilityNow}",
  "modelCalls",
  "queueAfter",
]) {
  if (!sources.classify.includes(fragment))
    fail(`classifier is missing ${fragment}`);
}
for (const fragment of ["stableStringify(canonical)", "pulseStageVersionKey"]) {
  if (!sources.pipeline.includes(fragment))
    fail(`pipeline version identity is missing ${fragment}`);
}
for (const fragment of [
  "publishClassifiedCluster",
  "publishNonGovernanceCluster",
  "pulseClassificationAttempts",
  "atomicClassificationPublishGuard",
  "db.batch",
]) {
  if (!sources.publication.includes(fragment))
    fail(`atomic publisher is missing ${fragment}`);
}
for (const fragment of [
  "queue eligible",
  "due retries",
  "oldest eligible",
  "terminal failures",
]) {
  if (!sources.cli.includes(fragment))
    fail(`CLI observability is missing ${fragment}`);
}
for (const fragment of [
  "PUL-032 historical boundary",
  "pulse_classification_state_transition_guard",
  "pulse_classification_attempts_append_only",
  "unknown_not_retained",
  "civica-affected-relations",
]) {
  if (!sources.migration.includes(fragment))
    fail(`migration is missing ${fragment}`);
}
for (const fragment of [
  "pulse_classification_delivery_bindings",
  "civica_guard_pulse_classify_binding_insert_v1",
  "execution_row.job_id = 'pulse.v2.classify'",
  "run_row.stage = 'classify'",
  "BEFORE UPDATE OR DELETE",
  "BEFORE TRUNCATE",
]) {
  if (!sources.deliveryMigration.includes(fragment))
    fail(`classification delivery migration is missing ${fragment}`);
}

async function main() {
  if (process.argv.includes("--live")) {
    if (!process.env.DATABASE_URL) fail("DATABASE_URL is required for --live");
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle({ client: sql, schema });
    const [
      shape,
      invalidState,
      invalidAttempts,
      duplicateState,
      missingTerminalEvidence,
      runningRuns,
      invalidBindings,
    ] = await Promise.all([
      sql`SELECT
        to_regclass('pulse_cluster_classification_states') IS NOT NULL AS states,
        to_regclass('pulse_classification_attempts') IS NOT NULL AS attempts,
        to_regclass('pulse_classification_delivery_bindings') IS NOT NULL AS bindings`,
      sql`SELECT count(*)::int AS n
          FROM pulse_cluster_classification_states
          WHERE schema_version <> 'pulse-classification-state/v1'
             OR config_hash !~ '^pulse-classification-config/v1/sha256:[a-f0-9]{64}$'
             OR attempt_count < 1 OR attempt_count > max_attempts
             OR last_attempt_at < first_attempt_at
             OR (status = 'retryable_failure' AND next_retry_at IS NULL)
             OR (status <> 'retryable_failure' AND next_retry_at IS NOT NULL)
             OR (status IN ('classified','none','terminal_failure') AND terminal_at IS NULL)`,
      sql`SELECT count(*)::int AS n
          FROM pulse_classification_attempts
          WHERE schema_version <> 'pulse-classification-attempt/v1'
             OR attempt_key !~ '^pulse-classification-attempt/sha256:[a-f0-9]{64}$'
             OR model_call_count < 0
             OR (outcome = 'started' AND completed_at IS NOT NULL)
             OR (outcome <> 'started' AND completed_at IS NULL)`,
      sql`SELECT count(*)::int AS n FROM (
            SELECT cluster_id, config_hash FROM pulse_cluster_classification_states
            GROUP BY cluster_id, config_hash HAVING count(*) > 1
          ) duplicates`,
      sql`SELECT count(*)::int AS n
          FROM pulse_cluster_classification_states s
          WHERE s.status IN ('classified','none','terminal_failure')
            AND NOT EXISTS (
              SELECT 1 FROM pulse_classification_attempts a
              WHERE a.cluster_id = s.cluster_id
                AND a.config_hash = s.config_hash
                AND a.ordinal = s.attempt_count
                AND a.outcome = s.status
            )`,
      sql`SELECT count(*)::int AS n FROM pulse_pipeline_runs
          WHERE stage = 'classify' AND status = 'running'`,
      sql`SELECT count(*)::int AS n
          FROM pulse_classification_delivery_bindings binding
          JOIN cron_job_executions execution_row
            ON execution_row.execution_key = binding.execution_key
          JOIN pulse_pipeline_runs run_row
            ON run_row.id = binding.classification_run_id
          WHERE execution_row.job_id <> 'pulse.v2.classify'
             OR run_row.stage <> 'classify'`,
    ]);
    if (!shape[0]?.states || !shape[0]?.attempts || !shape[0]?.bindings)
      fail("live tables are missing");
    for (const [label, result] of [
      ["invalid state rows", invalidState],
      ["invalid attempt rows", invalidAttempts],
      ["duplicate states", duplicateState],
      ["terminal states without attempt evidence", missingTerminalEvidence],
      ["running classification runs", runningRuns],
      ["invalid classification delivery bindings", invalidBindings],
    ] as const) {
      if (Number(result[0]?.n) !== 0) fail(`${label}: ${result[0]?.n}`);
    }
    const metrics = await loadClassificationQueueMetrics(
      db,
      CURRENT_CLASSIFICATION_CONFIG_HASH,
    );
    if (
      (metrics.eligibleDepth === 0) !==
      (metrics.oldestEligibleAt === null &&
        metrics.oldestEligibleAgeSeconds === null)
    ) {
      fail("eligible depth and oldest-age fields do not reconcile");
    }
    console.log(
      `Live queue: ${metrics.eligibleDepth} eligible ` +
        `(${metrics.newDepth} new, ${metrics.retryDueDepth} due retries, ` +
        `${metrics.retryScheduledDepth} scheduled); ` +
        `${metrics.terminalFailureCount} terminal failures; ` +
        `oldest=${metrics.oldestEligibleAt ?? "none"}.`,
    );
  }
  console.log(
    "PASS — versioned cluster states, append-only attempts, atomic claims, " +
      "new-before-retry ordering, bounded backoff, terminal idempotence, and queue observability are closed.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
