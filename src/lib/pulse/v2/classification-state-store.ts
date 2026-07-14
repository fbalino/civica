import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/lib/db/schema";
import {
  PULSE_CLASSIFICATION_ATTEMPT_VERSION,
  PULSE_CLASSIFICATION_CLAIM_LEASE_MS,
  PULSE_CLASSIFICATION_RETRY_POLICY,
  PULSE_CLASSIFICATION_STATE_VERSION,
  classifyClassificationError,
  retryDelayMs,
  type ClassificationConfigInput,
  type PulseClassificationStatus,
} from "./classification-state";

type Db = NeonHttpDatabase<typeof schema>;

function rows(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
}

export interface ClaimedClassificationAttempt {
  clusterId: string;
  incidentId: string | null;
  configHash: string;
  ordinal: number;
  runId: string;
  startedAt: Date;
}

export function classificationAttemptKey(
  claim: Pick<
    ClaimedClassificationAttempt,
    "clusterId" | "configHash" | "ordinal" | "runId"
  >,
  outcome: PulseClassificationStatus | "started",
): string {
  const digest = createHash("sha256")
    .update(
      [
        claim.clusterId.toLowerCase(),
        claim.configHash,
        String(claim.ordinal),
        claim.runId.toLowerCase(),
        outcome,
      ].join("\n"),
    )
    .digest("hex");
  return `pulse-classification-attempt/sha256:${digest}`;
}

const EXPIRED_FINAL_CLAIM_CODE = "classification_claim_expired_at_retry_limit";
const EXPIRED_FINAL_CLAIM_MESSAGE =
  "The final classifier claim expired before it could record an outcome.";

/**
 * A process can die after atomically claiming the final ordinal but before it
 * settles that claim. Once the lease expires there is no ordinal left to
 * advance to, so recover that exact state to terminal failure and append the
 * matching terminal attempt in one statement. The zero model-call count means
 * no completed call was durably evidenced; metadata preserves that limitation.
 */
export async function recoverExpiredFinalClassificationClaim(
  db: Db,
  input: { clusterId: string; configHash: string; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const result = await db.execute(sql`
    WITH recovered AS (
      UPDATE pulse_cluster_classification_states
      SET status = 'terminal_failure',
          next_retry_at = NULL,
          terminal_at = ${now},
          lease_expires_at = NULL,
          last_error_code = ${EXPIRED_FINAL_CLAIM_CODE},
          last_error_message = ${EXPIRED_FINAL_CLAIM_MESSAGE},
          event_id = NULL,
          updated_at = ${now}
      WHERE cluster_id = ${input.clusterId}::uuid
        AND config_hash = ${input.configHash}
        AND status = 'retryable_failure'
        AND attempt_count = max_attempts
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at <= ${now}
      RETURNING cluster_id, incident_id, config_hash, attempt_count,
                last_run_id, last_attempt_at
    ), recorded AS (
      INSERT INTO pulse_classification_attempts (
        schema_version, attempt_key, cluster_id, incident_id, config_hash,
        ordinal, run_id, outcome, model_call_count, started_at, completed_at,
        next_retry_at, error_code, error_message, metadata, created_at
      )
      SELECT
        ${PULSE_CLASSIFICATION_ATTEMPT_VERSION},
        'pulse-classification-attempt/sha256:' || encode(
          digest(
            r.cluster_id::text || E'\n' || r.config_hash || E'\n' ||
            r.attempt_count::text || E'\n' || r.last_run_id::text ||
            E'\nterminal_failure',
            'sha256'
          ),
          'hex'
        ),
        r.cluster_id, r.incident_id, r.config_hash, r.attempt_count,
        r.last_run_id, 'terminal_failure', 0, r.last_attempt_at, ${now},
        NULL, ${EXPIRED_FINAL_CLAIM_CODE}, ${EXPIRED_FINAL_CLAIM_MESSAGE},
        ${JSON.stringify({
          recovery: "expired_final_claim",
          modelCallCountStanding: "unknown_not_retained",
        })}::jsonb,
        ${now}
      FROM recovered r
      ON CONFLICT (attempt_key) DO NOTHING
      RETURNING cluster_id
    )
    SELECT
      (SELECT COUNT(*)::integer FROM recovered) AS recovered_count,
      1 / CASE WHEN NOT EXISTS (SELECT 1 FROM recovered)
        OR EXISTS (SELECT 1 FROM recorded)
        OR EXISTS (
        SELECT 1
        FROM recovered r
        JOIN pulse_classification_attempts a
          ON a.cluster_id = r.cluster_id
         AND a.config_hash = r.config_hash
         AND a.ordinal = r.attempt_count
         AND a.run_id = r.last_run_id
         AND a.outcome = 'terminal_failure'
         AND a.completed_at IS NOT NULL
      ) THEN 1 ELSE 0 END AS recovery_guard
  `);
  return Number(rows(result)[0]?.recovered_count ?? 0) === 1;
}

/**
 * Atomically claims one cluster/config attempt. A concurrent runner receives
 * null until the lease expires, so two cron invocations cannot spend on the
 * same cluster at once.
 */
export async function claimClassificationAttempt(
  db: Db,
  input: {
    clusterId: string;
    incidentId?: string | null;
    configHash: string;
    config: ClassificationConfigInput;
    runId: string;
    now?: Date;
  },
): Promise<ClaimedClassificationAttempt | null> {
  const now = input.now ?? new Date();
  if (
    await recoverExpiredFinalClassificationClaim(db, {
      clusterId: input.clusterId,
      configHash: input.configHash,
      now,
    })
  ) {
    return null;
  }
  const leaseExpiresAt = new Date(
    now.getTime() + PULSE_CLASSIFICATION_CLAIM_LEASE_MS,
  );
  const result = await db.execute(sql`
    WITH claimed AS (
      INSERT INTO pulse_cluster_classification_states (
      schema_version, cluster_id, incident_id, config_hash, config, status,
      attempt_count, max_attempts, first_attempt_at, last_attempt_at,
      next_retry_at, terminal_at, lease_expires_at, last_error_code,
      last_error_message, last_run_id, event_id, created_at, updated_at
    ) VALUES (
      ${PULSE_CLASSIFICATION_STATE_VERSION}, ${input.clusterId}::uuid,
      ${input.incidentId ?? null}::uuid, ${input.configHash},
      ${JSON.stringify(input.config)}::jsonb, 'retryable_failure', 1,
      ${PULSE_CLASSIFICATION_RETRY_POLICY.maxAttempts}, ${now}, ${now}, ${leaseExpiresAt},
      NULL, ${leaseExpiresAt}, 'attempt_in_progress',
      'Classifier attempt is in progress.', ${input.runId}::uuid, NULL,
      ${now}, ${now}
    )
    ON CONFLICT (cluster_id, config_hash) DO UPDATE SET
      incident_id = COALESCE(EXCLUDED.incident_id, pulse_cluster_classification_states.incident_id),
      config = EXCLUDED.config,
      attempt_count = pulse_cluster_classification_states.attempt_count + 1,
      last_attempt_at = EXCLUDED.last_attempt_at,
      next_retry_at = EXCLUDED.next_retry_at,
      lease_expires_at = EXCLUDED.lease_expires_at,
      last_error_code = EXCLUDED.last_error_code,
      last_error_message = EXCLUDED.last_error_message,
      last_run_id = EXCLUDED.last_run_id,
      updated_at = EXCLUDED.updated_at
    WHERE pulse_cluster_classification_states.status = 'retryable_failure'
      AND pulse_cluster_classification_states.next_retry_at <= ${now}
      AND pulse_cluster_classification_states.attempt_count < pulse_cluster_classification_states.max_attempts
      RETURNING cluster_id, incident_id, config_hash, attempt_count, last_run_id
    ), recorded AS (
      INSERT INTO pulse_classification_attempts (
      schema_version, attempt_key, cluster_id, incident_id, config_hash,
      ordinal, run_id, outcome, model_call_count, started_at, completed_at,
      next_retry_at, error_code, error_message, metadata, created_at
      )
      SELECT
        ${PULSE_CLASSIFICATION_ATTEMPT_VERSION},
        'pulse-classification-attempt/sha256:' || encode(
          digest(
            c.cluster_id::text || E'\n' || c.config_hash || E'\n' ||
            c.attempt_count::text || E'\n' || c.last_run_id::text || E'\nstarted',
            'sha256'
          ),
          'hex'
        ),
        c.cluster_id, c.incident_id, c.config_hash, c.attempt_count,
        c.last_run_id, 'started', 0, ${now}, NULL, NULL, NULL, NULL,
        ${JSON.stringify({ leaseExpiresAt: leaseExpiresAt.toISOString() })}::jsonb,
        ${now}
      FROM claimed c
      ON CONFLICT (attempt_key) DO NOTHING
      RETURNING ordinal
    )
    SELECT attempt_count, incident_id FROM claimed
  `);
  const row = rows(result)[0];
  if (!row) return null;
  const ordinal = Number(row.attempt_count);
  return {
    clusterId: input.clusterId,
    incidentId: row.incident_id ? String(row.incident_id) : null,
    configHash: input.configHash,
    ordinal,
    runId: input.runId,
    startedAt: now,
  };
}

export async function settleClassificationAttempt(
  db: Db,
  claim: ClaimedClassificationAttempt,
  input:
    | { outcome: "classified"; eventId: string; modelCallCount: number }
    | { outcome: "none"; modelCallCount: number }
    | {
        outcome: "failure";
        error: unknown;
        retryable?: boolean;
        modelCallCount: number;
      },
  now = new Date(),
): Promise<PulseClassificationStatus> {
  const sanitized =
    input.outcome === "failure"
      ? classifyClassificationError(input.error)
      : null;
  const retryable =
    input.outcome === "failure" &&
    (input.retryable ?? sanitized?.retryable ?? true) &&
    claim.ordinal < PULSE_CLASSIFICATION_RETRY_POLICY.maxAttempts;
  const status: PulseClassificationStatus =
    input.outcome === "classified"
      ? "classified"
      : input.outcome === "none"
        ? "none"
        : retryable
          ? "retryable_failure"
          : "terminal_failure";
  const nextRetryAt = retryable
    ? new Date(
        now.getTime() +
          retryDelayMs(claim.ordinal, PULSE_CLASSIFICATION_RETRY_POLICY),
      )
    : null;
  const eventId = input.outcome === "classified" ? input.eventId : null;
  const terminalAt = status === "retryable_failure" ? null : now;
  const attemptKey = classificationAttemptKey(claim, status);

  const updated = await db.execute(sql`
    WITH settled AS (
      UPDATE pulse_cluster_classification_states
      SET status = ${status}, next_retry_at = ${nextRetryAt},
          terminal_at = ${terminalAt}, lease_expires_at = NULL,
          last_error_code = ${sanitized?.code ?? null},
          last_error_message = ${sanitized?.message ?? null},
          event_id = ${eventId}::uuid, updated_at = ${now}
      WHERE cluster_id = ${claim.clusterId}::uuid
        AND config_hash = ${claim.configHash}
        AND attempt_count = ${claim.ordinal}
        AND last_run_id = ${claim.runId}::uuid
        AND status = 'retryable_failure'
      RETURNING cluster_id, incident_id, config_hash, attempt_count, last_run_id
    ), recorded AS (
      INSERT INTO pulse_classification_attempts (
        schema_version, attempt_key, cluster_id, incident_id, config_hash,
        ordinal, run_id, outcome, model_call_count, started_at, completed_at,
        next_retry_at, error_code, error_message, metadata, created_at
      )
      SELECT
        ${PULSE_CLASSIFICATION_ATTEMPT_VERSION},
        ${attemptKey},
        s.cluster_id, s.incident_id, s.config_hash, s.attempt_count,
        s.last_run_id, ${status}, ${input.modelCallCount},
        ${claim.startedAt}, ${now}, ${nextRetryAt},
        ${sanitized?.code ?? null}, ${sanitized?.message ?? null},
        '{}'::jsonb, ${now}
      FROM settled s
      ON CONFLICT (attempt_key) DO NOTHING
      RETURNING ordinal
    )
    SELECT attempt_count FROM settled
  `);
  if (rows(updated).length !== 1) {
    // A transaction may commit even if its HTTP response is lost. In that
    // case the caller's catch path must observe the durable terminal result,
    // never overwrite a successful classified/none publication with failure.
    const current = await db.execute(sql`
      SELECT status
      FROM pulse_cluster_classification_states
      WHERE cluster_id = ${claim.clusterId}::uuid
        AND config_hash = ${claim.configHash}
        AND attempt_count = ${claim.ordinal}
        AND last_run_id = ${claim.runId}::uuid
      LIMIT 1
    `);
    const currentStatus = rows(current)[0]?.status;
    if (
      currentStatus === "classified" ||
      currentStatus === "none" ||
      currentStatus === "retryable_failure" ||
      currentStatus === "terminal_failure"
    ) {
      return currentStatus;
    }
    throw new Error(
      `Classification attempt ${claim.clusterId}/${claim.ordinal} lost its claim`,
    );
  }
  return status;
}

export interface ClassificationQueueMetricsRow {
  newDepth: number;
  retryDueDepth: number;
  retryScheduledDepth: number;
  classifiedCount: number;
  noneCount: number;
  terminalFailureCount: number;
  eligibleDepth: number;
  oldestEligibleAt: string | null;
  oldestEligibleAgeSeconds: number | null;
}

export async function loadClassificationQueueMetrics(
  db: Db,
  configHash: string,
  now = new Date(),
): Promise<ClassificationQueueMetricsRow> {
  const result = await db.execute(sql`
    WITH clusters AS (
      SELECT r.cluster_id,
             MIN(COALESCE(r.clustered_at, r.retrieved_at, r.created_at)) AS queued_at
      FROM raw_events r
      WHERE r.cluster_id IS NOT NULL
        AND r.classification_disposition = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM pulse_sources ps WHERE ps.raw_event_id = r.id
        )
      GROUP BY r.cluster_id
    ), joined AS (
      SELECT c.cluster_id, c.queued_at, s.status, s.next_retry_at
      FROM clusters c
      LEFT JOIN pulse_cluster_classification_states s
        ON s.cluster_id = c.cluster_id AND s.config_hash = ${configHash}
    )
    SELECT
      COUNT(*) FILTER (WHERE status IS NULL)::int AS new_depth,
      COUNT(*) FILTER (WHERE status = 'retryable_failure' AND next_retry_at <= ${now})::int AS retry_due_depth,
      COUNT(*) FILTER (WHERE status = 'retryable_failure' AND next_retry_at > ${now})::int AS retry_scheduled_depth,
      (SELECT COUNT(*)::int FROM pulse_cluster_classification_states
       WHERE config_hash = ${configHash} AND status = 'classified') AS classified_count,
      (SELECT COUNT(*)::int FROM pulse_cluster_classification_states
       WHERE config_hash = ${configHash} AND status = 'none') AS none_count,
      (SELECT COUNT(*)::int FROM pulse_cluster_classification_states
       WHERE config_hash = ${configHash} AND status = 'terminal_failure') AS terminal_failure_count,
      COUNT(*) FILTER (WHERE status IS NULL OR (status = 'retryable_failure' AND next_retry_at <= ${now}))::int AS eligible_depth,
      MIN(queued_at) FILTER (WHERE status IS NULL OR (status = 'retryable_failure' AND next_retry_at <= ${now})) AS oldest_eligible_at
    FROM joined
  `);
  const row = rows(result)[0] ?? {};
  const oldest = row.oldest_eligible_at
    ? new Date(String(row.oldest_eligible_at))
    : null;
  return {
    newDepth: Number(row.new_depth ?? 0),
    retryDueDepth: Number(row.retry_due_depth ?? 0),
    retryScheduledDepth: Number(row.retry_scheduled_depth ?? 0),
    classifiedCount: Number(row.classified_count ?? 0),
    noneCount: Number(row.none_count ?? 0),
    terminalFailureCount: Number(row.terminal_failure_count ?? 0),
    eligibleDepth: Number(row.eligible_depth ?? 0),
    oldestEligibleAt: oldest?.toISOString() ?? null,
    oldestEligibleAgeSeconds: oldest
      ? Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / 1000))
      : null,
  };
}
