import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export const MAX_CRON_ATTEMPTS = 3;

export interface CronExecutionClaimInput {
  executionKey: string;
  jobId: string;
  route: string;
  triggerKind: "scheduled" | "manual";
  scheduleSlot: Date | null;
  requestMode: "apply" | "dry_run";
  scopeKey: string | null;
  requestSha256: string;
  leaseMs: number;
  maxAttempts: number;
}

export type CronExecutionClaim =
  | {
      state: "acquired";
      leaseToken: string;
      leaseExpiresAt: Date;
      attemptCount: number;
      attemptId: string;
      leaseFence: number;
    }
  | {
      state: "running";
      leaseExpiresAt: Date;
      attemptCount: number;
    }
  | {
      /** A different logical delivery currently owns the job-wide lease. */
      state: "busy";
      leaseExpiresAt: Date;
    }
  | {
      state: "succeeded";
      completedAt: Date;
      responseStatus: number;
      attemptCount: number;
    }
  | {
      state: "conflict";
      attemptCount: number;
    }
  | {
      state: "exhausted";
      attemptCount: number;
    };

export interface CronExecutionFinishInput {
  executionKey: string;
  jobId: string;
  leaseToken: string;
  attemptId: string;
  leaseFence: number;
  status: "succeeded" | "failed";
  responseStatus: number;
  resultCode: string;
}

export interface CronExecutionStore {
  acquire(input: CronExecutionClaimInput): Promise<CronExecutionClaim>;
  finish(input: CronExecutionFinishInput): Promise<boolean>;
}

interface ClaimRow {
  claim_state: string;
  lease_token: string | null;
  lease_expires_at: string | Date | null;
  attempt_count: number | string;
  attempt_id: string | null;
  lease_fence: number | string | null;
  completed_at: string | Date | null;
  response_status: number | string | null;
}

function resultRows(result: unknown): Record<string, unknown>[] {
  return (
    Array.isArray(result)
      ? result
      : ((result as { rows?: Record<string, unknown>[] }).rows ?? [])
  ) as Record<string, unknown>[];
}

function requiredDate(value: string | Date | null, field: string): Date {
  const parsed = value instanceof Date ? value : new Date(value ?? Number.NaN);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`Cron execution function returned invalid ${field}`);
  }
  return parsed;
}

function requiredPositiveInteger(
  value: number | string | null,
  field: string,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Cron execution function returned invalid ${field}`);
  }
  return parsed;
}

function requiredStatus(value: number | string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 599) {
    throw new Error("Cron execution function returned invalid response_status");
  }
  return parsed;
}

/**
 * Claiming is one database statement. The migration function locks the
 * job-wide lease row, evaluates expiry with PostgreSQL clock_timestamp(),
 * closes any abandoned attempt, and creates the next fenced attempt atomically.
 */
async function acquirePostgresCronExecution(
  input: CronExecutionClaimInput,
): Promise<CronExecutionClaim> {
  const leaseSeconds = input.leaseMs / 1_000;
  if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1) {
    throw new Error("Cron lease duration must be a positive whole second");
  }
  if (!Number.isSafeInteger(input.maxAttempts) || input.maxAttempts < 1) {
    throw new Error("Cron retry cap must be a positive integer");
  }

  const candidateLeaseToken = randomUUID();
  const candidateAttemptId = randomUUID();
  const result = await db.execute(sql`
    SELECT *
    FROM civica_acquire_cron_job_v1(
      ${input.executionKey}::text,
      ${input.jobId}::text,
      ${input.route}::text,
      ${input.triggerKind}::text,
      ${input.scheduleSlot}::timestamptz,
      ${input.requestMode}::text,
      ${input.scopeKey}::text,
      ${input.requestSha256}::text,
      ${leaseSeconds}::integer,
      ${input.maxAttempts}::integer,
      ${candidateLeaseToken}::uuid,
      ${candidateAttemptId}::uuid
    )
  `);
  const row = resultRows(result)[0] as unknown as ClaimRow | undefined;
  if (!row || resultRows(result).length !== 1) {
    throw new Error("Cron acquisition function returned no unique result");
  }

  const attemptCount = requiredPositiveInteger(
    row.attempt_count,
    "attempt_count",
  );
  switch (row.claim_state) {
    case "acquired":
      if (!row.lease_token || !row.attempt_id) {
        throw new Error("Cron acquisition omitted its lease identity");
      }
      return {
        state: "acquired",
        leaseToken: row.lease_token,
        leaseExpiresAt: requiredDate(row.lease_expires_at, "lease_expires_at"),
        attemptCount,
        attemptId: row.attempt_id,
        leaseFence: requiredPositiveInteger(row.lease_fence, "lease_fence"),
      };
    case "running":
      return {
        state: "running",
        leaseExpiresAt: requiredDate(row.lease_expires_at, "lease_expires_at"),
        attemptCount,
      };
    case "busy":
      return {
        state: "busy",
        leaseExpiresAt: requiredDate(row.lease_expires_at, "lease_expires_at"),
      };
    case "succeeded":
      return {
        state: "succeeded",
        completedAt: requiredDate(row.completed_at, "completed_at"),
        responseStatus: requiredStatus(row.response_status),
        attemptCount,
      };
    case "conflict":
      return { state: "conflict", attemptCount };
    case "exhausted":
      return { state: "exhausted", attemptCount };
    default:
      throw new Error(
        `Cron acquisition function returned unknown state: ${row.claim_state}`,
      );
  }
}

/** Finalization is fenced and atomic; a stale runner cannot close a newer try. */
async function finishPostgresCronExecution(
  input: CronExecutionFinishInput,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT civica_finish_cron_job_v1(
      ${input.jobId}::text,
      ${input.executionKey}::text,
      ${input.attemptId}::uuid,
      ${input.leaseToken}::uuid,
      ${input.leaseFence}::integer,
      ${input.status}::text,
      ${input.responseStatus}::integer,
      ${input.resultCode}::text
    ) AS finished
  `);
  const rows = resultRows(result);
  return rows.length === 1 && rows[0].finished === true;
}

export const postgresCronExecutionStore: CronExecutionStore = {
  acquire: acquirePostgresCronExecution,
  finish: finishPostgresCronExecution,
};
