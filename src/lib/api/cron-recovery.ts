import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { cronJobExecutions, cronJobLeases } from "@/lib/db/schema";
import { CRON_JOB_DEFINITIONS } from "@/lib/api/cron-job-registry";
import { SITE_URL } from "@/lib/site";

export const CRON_RECOVERY_EXECUTION_HEADER =
  "x-civica-cron-recovery-execution" as const;
export const CRON_RECOVERY_LOOKBACK_MS = 48 * 60 * 60 * 1_000;
export const CRON_RECOVERY_BATCH_SIZE = 4;
export const CRON_RECOVERY_DISPATCH_TIMEOUT_MS = 650 * 1_000;

const RECOVERY_BACKOFF_MS = [15 * 60 * 1_000, 60 * 60 * 1_000] as const;
const RECOVERY_QUERY_LIMIT = 128;

const RETRYABLE_RESPONSE_STATUSES = new Set([408, 425, 429, 502, 503, 504]);
const RETRYABLE_RESULT_CODES = new Set([
  "upstream_timeout",
  "upstream_rate_limited",
  "upstream_unavailable",
  "upstream_network_error",
  "pipeline_observability_unavailable",
]);

const EXCLUDED_RECOVERY_JOBS = new Set([
  // This stage can incur paid classifier traffic. It remains operator-run
  // until its separate budget and transport gates are enabled.
  "pulse.v2.classify",
  // Vercel does not provide the local ONNX runtime this stage requires. Its
  // intentional degraded outcome must not create futile automatic retries.
  "pulse.v2.cluster",
  // These routes may legitimately consume the full 800-second platform cap.
  // The health monitor must retain enough time to finalize its own ledger row.
  "factbook.wikidata",
  "factbook.officeholders",
  // Monitors and this dispatcher do not mutate source data and must never
  // recursively retry one another.
  "operations.error-alerts",
  "operations.pipeline-alerts",
  "operations.health-alerts",
]);

const RECOVERABLE_JOBS = new Map(
  CRON_JOB_DEFINITIONS.filter(
    ({ id, retired }) => !retired && !EXCLUDED_RECOVERY_JOBS.has(id),
  ).map(({ id, route }) => [id, route]),
);
const RECOVERABLE_JOB_IDS = [...RECOVERABLE_JOBS.keys()];

export interface CronRecoveryRow {
  executionKey: string;
  jobId: string;
  route: string;
  scheduleSlot: Date;
  status: "running" | "succeeded" | "failed";
  attemptCount: number;
  maxAttempts: number;
  completedAt: Date | null;
  responseStatus: number | null;
  resultCode: string | null;
  leaseExecutionKey: string | null;
  leaseExpiresAt: Date | null;
}

export interface CronRecoveryCandidate {
  executionKey: string;
  jobId: string;
  route: string;
  scheduleSlot: Date;
  attemptCount: number;
  dueAt: Date;
  reason: "transient_failure" | "expired_attempt";
}

export interface CronRecoveryStore {
  listDue(now: Date, limit?: number): Promise<CronRecoveryCandidate[]>;
  resolveDue(
    executionKey: string,
    jobId: string,
    now: Date,
  ): Promise<CronRecoveryCandidate | null>;
}

function validDate(value: Date | null): value is Date {
  return Boolean(value && Number.isFinite(value.getTime()));
}

export function recoveryCandidate(
  row: CronRecoveryRow,
  now: Date,
): CronRecoveryCandidate | null {
  if (!Number.isFinite(now.getTime())) return null;
  if (RECOVERABLE_JOBS.get(row.jobId) !== row.route) return null;
  if (!/^[a-f0-9]{64}$/.test(row.executionKey)) return null;
  if (!validDate(row.scheduleSlot)) return null;
  if (row.scheduleSlot.getTime() > now.getTime()) return null;
  if (row.scheduleSlot.getTime() < now.getTime() - CRON_RECOVERY_LOOKBACK_MS) {
    return null;
  }
  if (
    !Number.isSafeInteger(row.attemptCount) ||
    !Number.isSafeInteger(row.maxAttempts) ||
    row.attemptCount < 1 ||
    row.attemptCount >= row.maxAttempts
  ) {
    return null;
  }

  if (row.status === "running") {
    if (
      row.leaseExecutionKey !== row.executionKey ||
      !validDate(row.leaseExpiresAt) ||
      row.leaseExpiresAt.getTime() > now.getTime()
    ) {
      return null;
    }
    return {
      executionKey: row.executionKey,
      jobId: row.jobId,
      route: row.route,
      scheduleSlot: row.scheduleSlot,
      attemptCount: row.attemptCount,
      dueAt: row.leaseExpiresAt,
      reason: "expired_attempt",
    };
  }

  if (
    row.status !== "failed" ||
    !validDate(row.completedAt) ||
    row.responseStatus === null ||
    !RETRYABLE_RESPONSE_STATUSES.has(row.responseStatus) ||
    !row.resultCode ||
    !RETRYABLE_RESULT_CODES.has(row.resultCode)
  ) {
    return null;
  }
  const delay = RECOVERY_BACKOFF_MS[row.attemptCount - 1];
  if (delay === undefined) return null;
  const dueAt = new Date(row.completedAt.getTime() + delay);
  if (dueAt.getTime() > now.getTime()) return null;
  return {
    executionKey: row.executionKey,
    jobId: row.jobId,
    route: row.route,
    scheduleSlot: row.scheduleSlot,
    attemptCount: row.attemptCount,
    dueAt,
    reason: "transient_failure",
  };
}

function mapRecoveryRow(row: {
  executionKey: string;
  jobId: string;
  route: string;
  scheduleSlot: Date | null;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  completedAt: Date | null;
  responseStatus: number | null;
  resultCode: string | null;
  leaseExecutionKey: string | null;
  leaseExpiresAt: Date | null;
}): CronRecoveryRow | null {
  if (!row.scheduleSlot) return null;
  if (!["running", "succeeded", "failed"].includes(row.status)) return null;
  return {
    ...row,
    scheduleSlot: row.scheduleSlot,
    status: row.status as CronRecoveryRow["status"],
  };
}

const recoverySelection = {
  executionKey: cronJobExecutions.executionKey,
  jobId: cronJobExecutions.jobId,
  route: cronJobExecutions.route,
  scheduleSlot: cronJobExecutions.scheduleSlot,
  status: cronJobExecutions.status,
  attemptCount: cronJobExecutions.attemptCount,
  maxAttempts: cronJobExecutions.maxAttempts,
  completedAt: cronJobExecutions.completedAt,
  responseStatus: cronJobExecutions.responseStatus,
  resultCode: cronJobExecutions.resultCode,
  leaseExecutionKey: cronJobLeases.executionKey,
  leaseExpiresAt: cronJobLeases.leaseExpiresAt,
};

export const postgresCronRecoveryStore: CronRecoveryStore = {
  async listDue(now, limit = CRON_RECOVERY_BATCH_SIZE) {
    const boundedLimit = Math.max(1, Math.min(limit, CRON_RECOVERY_BATCH_SIZE));
    const since = new Date(now.getTime() - CRON_RECOVERY_LOOKBACK_MS);
    const rows = await db
      .select(recoverySelection)
      .from(cronJobExecutions)
      .leftJoin(
        cronJobLeases,
        eq(cronJobLeases.jobId, cronJobExecutions.jobId),
      )
      .where(
        and(
          eq(cronJobExecutions.triggerKind, "scheduled"),
          gte(cronJobExecutions.scheduleSlot, since),
          inArray(cronJobExecutions.jobId, RECOVERABLE_JOB_IDS),
        ),
      )
      .orderBy(desc(cronJobExecutions.updatedAt))
      .limit(RECOVERY_QUERY_LIMIT);
    const seenJobs = new Set<string>();
    return rows
      .flatMap((row) => {
        const mapped = mapRecoveryRow(row);
        return mapped ? [recoveryCandidate(mapped, now)].filter(Boolean) : [];
      })
      .sort((left, right) => {
        const dueDelta = left!.dueAt.getTime() - right!.dueAt.getTime();
        return dueDelta || left!.executionKey.localeCompare(right!.executionKey);
      })
      .filter((candidate) => {
        if (seenJobs.has(candidate!.jobId)) return false;
        seenJobs.add(candidate!.jobId);
        return true;
      })
      .slice(0, boundedLimit) as CronRecoveryCandidate[];
  },

  async resolveDue(executionKey, jobId, now) {
    const rows = await db
      .select(recoverySelection)
      .from(cronJobExecutions)
      .leftJoin(
        cronJobLeases,
        eq(cronJobLeases.jobId, cronJobExecutions.jobId),
      )
      .where(
        and(
          eq(cronJobExecutions.executionKey, executionKey),
          eq(cronJobExecutions.jobId, jobId),
          eq(cronJobExecutions.triggerKind, "scheduled"),
        ),
      )
      .limit(1);
    const row = rows[0] ? mapRecoveryRow(rows[0]) : null;
    return row ? recoveryCandidate(row, now) : null;
  },
};

export interface CronRecoveryDispatchResult {
  checked: number;
  dispatched: number;
  completed: number;
  retrySucceeded: number;
  retryFailed: number;
  transportFailed: number;
}

export async function dispatchDueCronRecoveries(input: {
  now?: Date;
  store?: CronRecoveryStore;
  fetcher?: typeof fetch;
  cronSecret?: string;
} = {}): Promise<CronRecoveryDispatchResult> {
  const now = input.now ?? new Date();
  const store = input.store ?? postgresCronRecoveryStore;
  const fetcher = input.fetcher ?? fetch;
  const cronSecret = input.cronSecret ?? process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("Cron recovery requires CRON_SECRET");
  const seenJobs = new Set<string>();
  const candidates = (
    await store.listDue(now, CRON_RECOVERY_BATCH_SIZE)
  ).filter((candidate) => {
    if (seenJobs.has(candidate.jobId)) return false;
    seenJobs.add(candidate.jobId);
    return true;
  }).slice(0, CRON_RECOVERY_BATCH_SIZE);
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      if (RECOVERABLE_JOBS.get(candidate.jobId) !== candidate.route) {
        throw new Error("Cron recovery target is not the registered job route");
      }
      const target = new URL(candidate.route, SITE_URL);
      if (target.origin !== SITE_URL || target.pathname !== candidate.route) {
        throw new Error("Cron recovery target escaped the canonical origin");
      }
      const response = await fetcher(target, {
        method: "GET",
        headers: {
          authorization: `Bearer ${cronSecret}`,
          [CRON_RECOVERY_EXECUTION_HEADER]: candidate.executionKey,
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(CRON_RECOVERY_DISPATCH_TIMEOUT_MS),
      });
      return response.status;
    }),
  );
  const completed = results.filter(
    (result) => result.status === "fulfilled",
  ).length;
  const retrySucceeded = results.filter(
    (result) =>
      result.status === "fulfilled" &&
      (result.value === 200 || result.value === 202),
  ).length;
  return {
    checked: candidates.length,
    dispatched: results.length,
    completed,
    retrySucceeded,
    retryFailed: completed - retrySucceeded,
    transportFailed: results.length - completed,
  };
}
