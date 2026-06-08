import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  scope: string;
  key: string;
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type DurableRateLimitOptions = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
};

type DurableRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const stores = new Map<string, Map<string, RateLimitEntry>>();
const SWEEP_INTERVAL_MS = 60_000;
const MAX_KEYS_PER_SCOPE = 10_000;
let lastSweepAt = 0;

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

function sweepExpired(now: number) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [scope, store] of stores) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
    if (store.size === 0) stores.delete(scope);
  }
}

function trimScope(store: Map<string, RateLimitEntry>) {
  if (store.size <= MAX_KEYS_PER_SCOPE) return;
  const overflow = store.size - MAX_KEYS_PER_SCOPE;
  let deleted = 0;
  for (const key of store.keys()) {
    store.delete(key);
    deleted++;
    if (deleted >= overflow) break;
  }
}

export function checkInMemoryRateLimit({
  scope,
  key,
  max,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  let store = stores.get(scope);
  if (!store) {
    store = new Map();
    stores.set(scope, store);
  }
  trimScope(store);

  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, max - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return {
    allowed: entry.count <= max,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

// ── Durable (cross-instance) fixed-window limiter ──────────────────────────
//
// The in-memory limiter above is per-serverless-instance: it resets on cold
// start and a flood spread across instances evades it (audit 2026-06-07
// Security #9). This variant backs the counter with the existing Neon
// Postgres (`rate_limits` table) so a per-IP window holds across instances
// and restarts — the control we want on the cost-sensitive /api/chat (paid
// LLM) endpoint.
//
// Design:
//   • Fixed window. windowStart = floor(now / windowMs) * windowMs; the
//     window is encoded in the row key, so a new window = a fresh row at
//     count 1. No read-modify-write race: a single INSERT … ON CONFLICT DO
//     UPDATE … RETURNING count increments and reads the live count atomically
//     under Postgres' row lock.
//   • allowed = count <= limit (so request #(limit+1) in a window is denied).
//   • Lazy cleanup: stale rows are reaped opportunistically (~1 in N calls)
//     via the expires_at index, not on every request.
//   • Graceful degradation: ANY DB error falls back to the in-memory limiter
//     so a database blip never fails an otherwise-valid request.

/** Run the expired-row sweep on ~1 in N calls (amortised cleanup). */
const DURABLE_CLEANUP_PROBABILITY = 0.02;

export async function checkDurableRateLimit({
  scope,
  key,
  limit,
  windowMs,
}: DurableRateLimitOptions): Promise<DurableRateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const bucketKey = `${scope}:${key}:${windowStart}`;
  const expiresAtIso = new Date(windowEnd).toISOString();

  try {
    // Atomic increment-and-read. INSERT seeds the window at 1; a concurrent
    // request on the same key conflicts and bumps the existing count by 1.
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${bucketKey}, 1, ${expiresAtIso}::timestamptz)
      ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `);
    const row = result.rows[0] as { count: number | string } | undefined;
    const count = row ? Number(row.count) : 1;

    // Opportunistic reap of expired windows — cheap (indexed) and rare.
    // Wrapped so a cleanup failure can never disturb the decision above.
    if (Math.random() < DURABLE_CLEANUP_PROBABILITY) {
      try {
        await db.execute(
          sql`DELETE FROM rate_limits WHERE expires_at < now()`
        );
      } catch {
        // best-effort housekeeping only
      }
    }

    const allowed = count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterMs: allowed ? 0 : Math.max(0, windowEnd - now),
    };
  } catch {
    // DB unreachable / transient error → degrade to the per-instance limiter
    // rather than failing the request. Best-effort cross-instance coverage.
    const fallback = checkInMemoryRateLimit({ scope, key, max: limit, windowMs });
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining,
      retryAfterMs: fallback.retryAfterSeconds * 1000,
    };
  }
}
