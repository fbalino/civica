import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

interface AcquireOptions {
  executionKey: string;
  jobId: string;
  triggerKind?: "scheduled" | "manual";
  scheduleSlot?: string | null;
  scopeKey?: string | null;
  requestSha?: string;
  leaseSeconds?: number;
  maxAttempts?: number;
}

interface ClaimRow {
  claim_state:
    | "acquired"
    | "running"
    | "busy"
    | "succeeded"
    | "conflict"
    | "exhausted";
  lease_token: string | null;
  lease_expires_at: string | null;
  attempt_count: number | string;
  attempt_id: string | null;
  lease_fence: number | string | null;
  completed_at: string | null;
  response_status: number | string | null;
}

const SLOT = "2026-07-14T08:00:00.000Z";
const hex = (character: string): string => character.repeat(64);

function migrationSql(): string {
  return readFileSync(
    "drizzle/authoritative/0034_superb_the_fallen.sql",
    "utf8",
  ).replaceAll("--> statement-breakpoint", "");
}

async function acquire(
  database: PGlite,
  {
    executionKey,
    jobId,
    triggerKind = "scheduled",
    scheduleSlot = SLOT,
    scopeKey = null,
    requestSha = hex("b"),
    leaseSeconds = 1_800,
    maxAttempts = 3,
  }: AcquireOptions,
): Promise<ClaimRow> {
  const result = await database.query<ClaimRow>(
    `SELECT * FROM public.civica_acquire_cron_job_v1(
      $1::text,$2::text,$3::text,$4::text,$5::timestamptz,$6::text,
      $7::text,$8::text,$9::integer,$10::integer,$11::uuid,$12::uuid
    )`,
    [
      executionKey,
      jobId,
      `/api/cron/test/${jobId}`,
      triggerKind,
      scheduleSlot,
      "apply",
      scopeKey,
      requestSha,
      leaseSeconds,
      maxAttempts,
      randomUUID(),
      randomUUID(),
    ],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}

async function finish(
  database: PGlite,
  claim: ClaimRow,
  jobId: string,
  executionKey: string,
  status: "succeeded" | "failed",
  responseStatus: number,
): Promise<boolean> {
  assert.ok(claim.attempt_id);
  assert.ok(claim.lease_token);
  assert.ok(claim.lease_fence);
  const result = await database.query<{ finished: boolean }>(
    `SELECT public.civica_finish_cron_job_v1(
      $1::text,$2::text,$3::uuid,$4::uuid,$5::integer,$6::text,
      $7::integer,$8::text
    ) AS finished`,
    [
      jobId,
      executionKey,
      claim.attempt_id,
      claim.lease_token,
      claim.lease_fence,
      status,
      responseStatus,
      status === "succeeded" ? "handler_succeeded" : "handler_failed",
    ],
  );
  return result.rows[0].finished;
}

/**
 * PGlite's official Node API (checked 2026-07-14) runs PostgreSQL in memory,
 * accepts multi-statement migrations via exec(), and supports parameterized
 * queries. It has one exclusive connection, so this test proves the real SQL
 * state machine while cron-job.test.ts separately exercises overlapping calls.
 */
test("terminal cron rows require complete terminal evidence on insert and update", async () => {
  const database = new PGlite();
  try {
    await database.exec(migrationSql());
    const executionKey = hex("0");
    const jobId = "factbook.test";
    const claim = await acquire(database, { executionKey, jobId });
    assert.equal(claim.claim_state, "acquired");

    await assert.rejects(
      database.query(
        `UPDATE cron_job_attempts SET status = 'succeeded'
         WHERE attempt_id = $1::uuid`,
        [claim.attempt_id],
      ),
      /terminal evidence cannot be rewritten/,
    );
    await assert.rejects(
      database.query(
        `UPDATE cron_job_executions SET status = 'succeeded'
         WHERE execution_key = $1`,
        [executionKey],
      ),
      /invalid cron execution finalization/,
    );

    await assert.rejects(
      database.query(
        `INSERT INTO cron_job_executions (
           execution_key, job_id, route, trigger_kind, schedule_slot,
           request_mode, scope_key, request_sha256, status, attempt_count,
           max_attempts, last_attempt_id, last_fence, first_started_at,
           last_started_at, completed_at, response_status, result_code,
           created_at, updated_at
         ) VALUES (
           $1, 'pulse.v2.test', '/api/cron/test/pulse.v2.test', 'manual', NULL,
           'apply', $2, $3, 'succeeded', 1, 3, $4::uuid, 1, NOW(), NOW(),
           NULL, NULL, NULL, NOW(), NOW()
         )`,
        [hex("8"), hex("9"), hex("a"), randomUUID()],
      ),
      /cron_job_execution_lifecycle_check/,
    );
    await assert.rejects(
      database.query(
        `INSERT INTO cron_job_attempts (
           attempt_id, execution_key, job_id, ordinal, fence, status,
           started_at, completed_at, response_status, result_code
         ) VALUES ($1::uuid, $2, $3, 2, $4, 'succeeded', NOW(), NULL, NULL, NULL)`,
        [
          randomUUID(),
          executionKey,
          jobId,
          Number(claim.lease_fence) + 1,
        ],
      ),
      /cron_job_attempt_lifecycle_check/,
    );
  } finally {
    await database.close();
  }
});

test("the PostgreSQL cron state machine deduplicates, fences, retries, and retains evidence", async () => {
  const database = new PGlite();
  try {
    await database.exec(migrationSql());

    const scheduledKey = hex("a");
    const scheduledJob = "pulse.v2.ingest";
    const first = await acquire(database, {
      executionKey: scheduledKey,
      jobId: scheduledJob,
    });
    assert.equal(first.claim_state, "acquired");
    assert.equal(
      (
        await acquire(database, {
          executionKey: scheduledKey,
          jobId: scheduledJob,
          requestSha: hex("c"),
        })
      ).claim_state,
      "conflict",
    );
    assert.equal(
      (
        await acquire(database, {
          executionKey: scheduledKey,
          jobId: scheduledJob,
        })
      ).claim_state,
      "running",
    );
    assert.equal(
      await finish(
        database,
        first,
        scheduledJob,
        scheduledKey,
        "succeeded",
        200,
      ),
      true,
    );
    assert.equal(
      (
        await acquire(database, {
          executionKey: scheduledKey,
          jobId: scheduledJob,
        })
      ).claim_state,
      "succeeded",
    );

    const manualJob = "pulse.v2.cluster";
    const manualScope = hex("c");
    const manualKey = hex("d");
    const manual = await acquire(database, {
      executionKey: manualKey,
      jobId: manualJob,
      triggerKind: "manual",
      scheduleSlot: null,
      scopeKey: manualScope,
    });
    assert.equal(manual.claim_state, "acquired");
    assert.equal(
      await finish(database, manual, manualJob, manualKey, "succeeded", 200),
      true,
    );
    assert.equal(
      (
        await acquire(database, {
          executionKey: manualKey,
          jobId: manualJob,
          triggerKind: "manual",
          scheduleSlot: null,
          scopeKey: manualScope,
        })
      ).claim_state,
      "succeeded",
    );
    assert.equal(
      (
        await acquire(database, {
          executionKey: manualKey,
          jobId: manualJob,
          triggerKind: "manual",
          scheduleSlot: null,
          scopeKey: manualScope,
          requestSha: hex("e"),
        })
      ).claim_state,
      "conflict",
    );

    const cappedJob = "pulse.v2.classify";
    const cappedKey = hex("f");
    for (let ordinal = 1; ordinal <= 3; ordinal++) {
      const claim = await acquire(database, {
        executionKey: cappedKey,
        jobId: cappedJob,
      });
      assert.equal(claim.claim_state, "acquired");
      assert.equal(Number(claim.attempt_count), ordinal);
      assert.equal(
        await finish(database, claim, cappedJob, cappedKey, "failed", 502),
        true,
      );
    }
    assert.equal(
      (
        await acquire(database, {
          executionKey: cappedKey,
          jobId: cappedJob,
        })
      ).claim_state,
      "exhausted",
    );

    const busyJob = "pulse.v2.score";
    const busyKey = hex("1");
    const held = await acquire(database, {
      executionKey: busyKey,
      jobId: busyJob,
      triggerKind: "manual",
      scheduleSlot: null,
      scopeKey: hex("2"),
    });
    assert.equal(held.claim_state, "acquired");
    assert.equal(
      (
        await acquire(database, {
          executionKey: hex("3"),
          jobId: busyJob,
          triggerKind: "manual",
          scheduleSlot: null,
          scopeKey: hex("4"),
        })
      ).claim_state,
      "busy",
    );
    const unrecordedBusy = await database.query<{
      executions: number;
      attempts: number;
    }>(
      `SELECT
         (SELECT count(*)::integer FROM cron_job_executions
          WHERE execution_key = $1) AS executions,
         (SELECT count(*)::integer FROM cron_job_attempts
          WHERE execution_key = $1) AS attempts`,
      [hex("3")],
    );
    assert.deepEqual(unrecordedBusy.rows[0], { executions: 0, attempts: 0 });
    assert.equal(
      await finish(database, held, busyJob, busyKey, "succeeded", 200),
      true,
    );

    const expiryJob = "factbook.wikidata";
    const staleKey = hex("5");
    const stale = await acquire(database, {
      executionKey: staleKey,
      jobId: expiryJob,
      triggerKind: "manual",
      scheduleSlot: null,
      scopeKey: hex("6"),
      leaseSeconds: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const takeoverKey = hex("7");
    const takeover = await acquire(database, {
      executionKey: takeoverKey,
      jobId: expiryJob,
      triggerKind: "manual",
      scheduleSlot: null,
      scopeKey: hex("8"),
      leaseSeconds: 1,
    });
    assert.equal(takeover.claim_state, "acquired");
    assert.equal(
      Number(takeover.lease_fence),
      Number(stale.lease_fence) + 1,
    );
    assert.equal(
      await finish(database, stale, expiryJob, staleKey, "succeeded", 200),
      false,
    );
    assert.equal(
      await finish(
        database,
        takeover,
        expiryJob,
        takeoverKey,
        "succeeded",
        200,
      ),
      true,
    );

    const lateJob = "factbook.officeholders";
    const lateKey = hex("9");
    const late = await acquire(database, {
      executionKey: lateKey,
      jobId: lateJob,
      leaseSeconds: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.equal(
      await finish(database, late, lateJob, lateKey, "succeeded", 200),
      true,
    );

    await assert.rejects(
      database.exec("DELETE FROM public.cron_job_attempts"),
      /cannot be deleted or truncated/,
    );
    await assert.rejects(
      database.exec("TRUNCATE public.cron_job_leases"),
      /cannot be deleted or truncated/,
    );
    await assert.rejects(
      database.exec(`
        UPDATE public.cron_job_attempts
        SET result_code = 'rewritten'
        WHERE status = 'succeeded'
      `),
      /cannot be rewritten/,
    );

    const counts = await database.query<{
      executions: number;
      attempts: number;
      leases: number;
    }>(`
      SELECT
        (SELECT count(*)::integer FROM public.cron_job_executions) AS executions,
        (SELECT count(*)::integer FROM public.cron_job_attempts) AS attempts,
        (SELECT count(*)::integer FROM public.cron_job_leases) AS leases
    `);
    assert.deepEqual(counts.rows[0], {
      executions: 7,
      attempts: 9,
      leases: 6,
    });
  } finally {
    await database.close();
  }
});
