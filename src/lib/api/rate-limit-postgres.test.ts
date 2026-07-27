import assert from "node:assert/strict";
import { test } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import {
  checkDurableRateLimit,
  createPostgresDurableRateLimitStore,
  type DurableRateLimitStore,
} from "./rate-limit";

const SUBJECT_HASH = "b".repeat(64);

async function harness(): Promise<{
  database: PGlite;
  storeA: DurableRateLimitStore;
  storeB: DurableRateLimitStore;
}> {
  const database = new PGlite();
  await database.exec(`
    CREATE TABLE rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 0,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX idx_rate_limits_expires_at
      ON rate_limits (expires_at);
  `);

  // These are deliberately separate Drizzle/store objects. They represent
  // independent serverless instances while sharing one PostgreSQL database.
  const clientA = drizzle(database);
  const clientB = drizzle(database);
  return {
    database,
    storeA: createPostgresDurableRateLimitStore((query) =>
      clientA.execute(query),
    ),
    storeB: createPostgresDurableRateLimitStore((query) =>
      clientB.execute(query),
    ),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("two limiter clients share one atomic bounded PostgreSQL counter", async () => {
  const state = await harness();
  try {
    const limit = 5;
    const options = {
      scope: "shared-counter",
      subjectHash: SUBJECT_HASH,
      limit,
      windowMs: 60_000,
    } as const;

    const attempts = await Promise.all(
      Array.from({ length: limit + 1 }, (_, index) =>
        checkDurableRateLimit(options, {
          store: index % 2 === 0 ? state.storeA : state.storeB,
        }),
      ),
    );

    assert.equal(
      attempts.filter((attempt) => attempt.status === "allowed").length,
      limit,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === "limited").length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === "store_unavailable")
        .length,
      0,
    );

    const firstBucket = await state.database.query<{
      key: string;
      count: number;
    }>("SELECT key, count FROM rate_limits");
    assert.equal(firstBucket.rows.length, 1);
    assert.equal(Number(firstBucket.rows[0].count), limit + 1);
    assert.match(
      firstBucket.rows[0].key,
      new RegExp(`^shared-counter:${SUBJECT_HASH}:\\d+$`),
    );

    const denied = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        checkDurableRateLimit(options, {
          store: index % 2 === 0 ? state.storeA : state.storeB,
        }),
      ),
    );
    assert.equal(
      denied.every((attempt) => attempt.status === "limited"),
      true,
    );

    const bounded = await state.database.query<{ count: number }>(
      "SELECT count FROM rate_limits WHERE key LIKE 'shared-counter:%'",
    );
    assert.equal(Number(bounded.rows[0].count), limit + 1);

    // A legacy/unbounded int4 row must not overflow while evaluating + 1
    // before LEAST applies the new cap.
    await state.database.query(
      "UPDATE rate_limits SET count = 2147483647 WHERE key LIKE 'shared-counter:%'",
    );
    const overflowSafe = await checkDurableRateLimit(options, {
      store: state.storeA,
    });
    assert.equal(overflowSafe.status, "limited");
    const recapped = await state.database.query<{ count: number }>(
      "SELECT count FROM rate_limits WHERE key LIKE 'shared-counter:%'",
    );
    assert.equal(Number(recapped.rows[0].count), limit + 1);

    const isolated = await checkDurableRateLimit(
      { ...options, scope: "other-scope" },
      { store: state.storeB },
    );
    assert.deepEqual(isolated, {
      status: "allowed",
      allowed: true,
      remaining: limit - 1,
      retryAfterMs: 0,
    });
    const bucketCount = await state.database.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM rate_limits",
    );
    assert.equal(Number(bucketCount.rows[0].count), 2);
  } finally {
    await state.database.close();
  }
});

test("every atomic increment removes expired legacy identity rows", async () => {
  const state = await harness();
  try {
    await state.database.exec(`
      INSERT INTO rate_limits (key, count, expires_at) VALUES
        ('chat-durable:203.0.113.42:1', 3, statement_timestamp() - interval '1 second'),
        ('constitution-search:2001:db8::1:1', 2, statement_timestamp() - interval '1 second'),
        ('chat-durable:active-fixture:2', 1, statement_timestamp() + interval '1 hour');
    `);

    const result = await checkDurableRateLimit(
      {
        scope: "cleanup-proof",
        subjectHash: SUBJECT_HASH,
        limit: 5,
        windowMs: 60_000,
      },
      { store: state.storeA },
    );
    assert.equal(result.status, "allowed");

    const rows = await state.database.query<{
      expired_legacy: number;
      active_legacy: number;
    }>(`
      SELECT
        count(*) FILTER (
          WHERE key IN (
            'chat-durable:203.0.113.42:1',
            'constitution-search:2001:db8::1:1'
          )
        )::integer AS expired_legacy,
        count(*) FILTER (
          WHERE key = 'chat-durable:active-fixture:2'
        )::integer AS active_legacy
      FROM rate_limits
    `);
    assert.equal(Number(rows.rows[0].expired_legacy), 0);
    assert.equal(
      Number(rows.rows[0].active_legacy),
      1,
      "unexpired rows must remain until their window ends",
    );
  } finally {
    await state.database.close();
  }
});

test("PostgreSQL time selects the fixed window and supplies the retry interval", async () => {
  const state = await harness();
  try {
    const windowMs = 400;
    const options = {
      scope: "database-clock",
      subjectHash: SUBJECT_HASH,
      limit: 1,
      windowMs,
    } as const;

    // Start just after a database-clock boundary so both immediate attempts
    // are deterministically in the same short window.
    const clock = await state.database.query<{ now_ms: number | string }>(`
      SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint
        AS now_ms
    `);
    const nowMs = Number(clock.rows[0].now_ms);
    await delay(windowMs - (nowMs % windowMs) + 20);

    const first = await checkDurableRateLimit(options, {
      store: state.storeA,
    });
    assert.deepEqual(first, {
      status: "allowed",
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });

    const limited = await checkDurableRateLimit(options, {
      store: state.storeB,
    });
    assert.equal(limited.status, "limited");
    assert.equal(limited.allowed, false);
    assert.ok(limited.retryAfterMs > 0);
    assert.ok(limited.retryAfterMs <= windowMs);

    const firstRow = await state.database.query<{
      key: string;
      expires_ms: number | string;
    }>(`
      SELECT
        key,
        floor(extract(epoch FROM expires_at) * 1000)::bigint AS expires_ms
      FROM rate_limits
      WHERE key LIKE 'database-clock:%'
    `);
    assert.equal(firstRow.rows.length, 1);
    const windowStartMs = Number(firstRow.rows[0].key.split(":").at(-1));
    assert.equal(Number(firstRow.rows[0].expires_ms) - windowStartMs, windowMs);

    await delay(limited.retryAfterMs + 25);
    const reset = await checkDurableRateLimit(options, {
      store: state.storeA,
    });
    assert.deepEqual(reset, {
      status: "allowed",
      allowed: true,
      remaining: 0,
      retryAfterMs: 0,
    });

    const afterReset = await state.database.query<{ count: number }>(
      "SELECT count(*)::integer AS count FROM rate_limits",
    );
    assert.equal(
      Number(afterReset.rows[0].count),
      1,
      "the same atomic increment statement must remove the expired window",
    );
  } finally {
    await state.database.close();
  }
});
