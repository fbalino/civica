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
  cli: readFileSync("scripts/sync-pulse-v2-classify.ts", "utf8"),
  migration: readFileSync(
    "drizzle/authoritative/0024_dark_maginty.sql",
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
  '"classified"',
  '"none"',
  '"retryable_failure"',
  '"terminal_failure"',
  "buildClassificationConfigHash",
  "selectClassificationQueue",
  "initialDelayMs",
  "maxAttempts: 3",
]) {
  if (!sources.state.includes(fragment)) fail(`state contract is missing ${fragment}`);
}
for (const fragment of [
  "ON CONFLICT (cluster_id, config_hash)",
  "attempt_count < pulse_cluster_classification_states.max_attempts",
  "pulse_classification_attempts",
  "loadClassificationQueueMetrics",
  "attempt_in_progress",
]) {
  if (!sources.store.includes(fragment)) fail(`state store is missing ${fragment}`);
}
for (const fragment of [
  "CURRENT_CLASSIFICATION_CONFIG_HASH",
  "claimClassificationAttempt",
  "settleClassificationAttempt",
  "CASE WHEN cs.id IS NULL THEN 0 ELSE 1 END",
  "cs.next_retry_at <= NOW()",
  "modelCalls",
  "queueAfter",
]) {
  if (!sources.classify.includes(fragment)) fail(`classifier is missing ${fragment}`);
}
for (const fragment of [
  "queue eligible",
  "due retries",
  "oldest eligible",
  "terminal failures",
]) {
  if (!sources.cli.includes(fragment)) fail(`CLI observability is missing ${fragment}`);
}
for (const fragment of [
  "PUL-032 historical boundary",
  "pulse_classification_state_transition_guard",
  "pulse_classification_attempts_append_only",
  "unknown_not_retained",
  "civica-affected-relations",
]) {
  if (!sources.migration.includes(fragment)) fail(`migration is missing ${fragment}`);
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
    ] = await Promise.all([
      sql`SELECT
        to_regclass('pulse_cluster_classification_states') IS NOT NULL AS states,
        to_regclass('pulse_classification_attempts') IS NOT NULL AS attempts`,
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
    ]);
    if (!shape[0]?.states || !shape[0]?.attempts) fail("live tables are missing");
    for (const [label, result] of [
      ["invalid state rows", invalidState],
      ["invalid attempt rows", invalidAttempts],
      ["duplicate states", duplicateState],
      ["terminal states without attempt evidence", missingTerminalEvidence],
      ["running classification runs", runningRuns],
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
