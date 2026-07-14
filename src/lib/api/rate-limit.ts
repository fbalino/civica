import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";

export type DurableRateLimitOptions = {
  scope: string;
  /**
   * A lowercase, 64-character hexadecimal digest. Callers must derive this
   * from the trusted request identity before invoking the shared limiter;
   * raw IP addresses must never cross the durable-store boundary.
   */
  subjectHash: string;
  limit: number;
  windowMs: number;
};

export type DurableRateLimitResult =
  | {
      status: "allowed";
      allowed: true;
      remaining: number;
      retryAfterMs: 0;
    }
  | {
      status: "limited";
      allowed: false;
      remaining: 0;
      retryAfterMs: number;
    }
  | {
      status: "store_unavailable";
      allowed: false;
      remaining: 0;
      retryAfterMs: null;
    };

export type DurableRateLimitIncrementResult = {
  count: number;
  retryAfterMs: number;
};

export interface DurableRateLimitStore {
  increment(
    input: DurableRateLimitOptions,
  ): Promise<DurableRateLimitIncrementResult>;
}

export interface DurableRateLimitDependencies {
  /** Stable test seam; production uses the shared Neon PostgreSQL store. */
  store?: DurableRateLimitStore;
}

// ── Durable (cross-instance) fixed-window limiter ──────────────────────────
//
// Production protection uses the existing `rate_limits` PostgreSQL table and one atomic
// INSERT … ON CONFLICT DO UPDATE … RETURNING statement. PostgreSQL chooses
// the fixed window from its own clock, so separate serverless instances with
// skewed application clocks still contend on the same row.

const OPAQUE_SUBJECT_PATTERN = /^[a-f0-9]{64}$/;
const SCOPE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const MAX_POSTGRES_COUNTER = 2_147_483_646;
const MAX_DURABLE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export type DurableRateLimitSqlExecutor = (query: SQL) => Promise<unknown>;

function assertDurableRateLimitOptions(options: DurableRateLimitOptions): void {
  if (!SCOPE_PATTERN.test(options.scope)) {
    throw new TypeError(
      "Durable rate-limit scope must start with a lowercase letter and contain only lowercase letters, digits, or hyphens (64 characters maximum).",
    );
  }
  if (!OPAQUE_SUBJECT_PATTERN.test(options.subjectHash)) {
    throw new TypeError(
      "Durable rate-limit subjectHash must be a lowercase 64-character hexadecimal digest; raw request identifiers are forbidden.",
    );
  }
  if (
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > MAX_POSTGRES_COUNTER
  ) {
    throw new TypeError(
      `Durable rate-limit limit must be an integer from 1 through ${MAX_POSTGRES_COUNTER}.`,
    );
  }
  if (
    !Number.isSafeInteger(options.windowMs) ||
    options.windowMs < 1 ||
    options.windowMs > MAX_DURABLE_WINDOW_MS
  ) {
    throw new TypeError(
      `Durable rate-limit windowMs must be an integer from 1 through ${MAX_DURABLE_WINDOW_MS}.`,
    );
  }
}

function rowsFromResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function finiteInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Durable rate-limit store returned an invalid ${label}.`);
  }
  return parsed;
}

function incrementStatement({
  scope,
  subjectHash,
  limit,
  windowMs,
}: DurableRateLimitOptions): SQL {
  return sql`
    WITH expired_cleanup AS (
      DELETE FROM rate_limits
      WHERE expires_at <= statement_timestamp()
      RETURNING 1
    ), clock AS (
      SELECT
        floor(extract(epoch FROM statement_timestamp()) * 1000)::bigint
          AS observed_at_ms
    ), bucket AS (
      SELECT
        (observed_at_ms / ${windowMs}::bigint) * ${windowMs}::bigint
          AS window_start_ms
      FROM clock
    ), incremented AS (
      INSERT INTO rate_limits AS current_bucket (key, count, expires_at)
      SELECT
        ${scope} || ':' || ${subjectHash} || ':' || window_start_ms::text,
        1,
        to_timestamp(
          (window_start_ms + ${windowMs}::bigint)::double precision / 1000.0
        )
      FROM bucket
      ON CONFLICT (key) DO UPDATE SET
        count = LEAST(
          current_bucket.count::bigint + 1,
          ${limit}::bigint + 1
        )::integer
      RETURNING count, expires_at
    )
    SELECT
      incremented.count,
      greatest(
        0,
        ceil(extract(epoch FROM (incremented.expires_at - clock_timestamp())) * 1000)
      )::bigint AS retry_after_ms
    FROM incremented
    CROSS JOIN (SELECT count(*) FROM expired_cleanup) AS cleanup_summary
  `;
}

/**
 * Build the durable store around a SQL executor. Production passes the shared
 * Neon/Drizzle executor; PostgreSQL-compatible tests can pass an independent
 * executor while exercising this exact statement.
 */
export function createPostgresDurableRateLimitStore(
  execute: DurableRateLimitSqlExecutor,
): DurableRateLimitStore {
  return {
    async increment(options) {
      // Validate again at the storage boundary so direct store use can never
      // persist a raw request identifier either.
      assertDurableRateLimitOptions(options);
      const result = await execute(incrementStatement(options));
      const row = rowsFromResult(result)[0];
      if (!row) {
        throw new Error(
          "Durable rate-limit increment returned no PostgreSQL row.",
        );
      }
      const count = finiteInteger(row.count, "count");
      const retryAfterMs = finiteInteger(row.retry_after_ms, "retry interval");
      if (count < 1 || count > options.limit + 1) {
        throw new Error(
          "Durable rate-limit count violated the bounded counter contract.",
        );
      }
      return { count, retryAfterMs };
    },
  };
}

const postgresDurableRateLimitStore = createPostgresDurableRateLimitStore(
  (query) => db.execute(query),
);

export async function checkDurableRateLimit(
  options: DurableRateLimitOptions,
  dependencies: DurableRateLimitDependencies = {},
): Promise<DurableRateLimitResult> {
  assertDurableRateLimitOptions(options);
  const store = dependencies.store ?? postgresDurableRateLimitStore;

  let incremented: DurableRateLimitIncrementResult;
  try {
    incremented = await store.increment(options);
    if (
      !Number.isSafeInteger(incremented.count) ||
      incremented.count < 1 ||
      incremented.count > options.limit + 1 ||
      !Number.isSafeInteger(incremented.retryAfterMs) ||
      incremented.retryAfterMs < 0
    ) {
      throw new Error("Durable rate-limit store result is invalid.");
    }
  } catch {
    return {
      status: "store_unavailable",
      allowed: false,
      remaining: 0,
      retryAfterMs: null,
    };
  }

  if (incremented.count > options.limit) {
    return {
      status: "limited",
      allowed: false,
      remaining: 0,
      retryAfterMs: incremented.retryAfterMs,
    };
  }

  return {
    status: "allowed",
    allowed: true,
    remaining: options.limit - incremented.count,
    retryAfterMs: 0,
  };
}
