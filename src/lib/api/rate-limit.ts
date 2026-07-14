import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestIp } from "./request-ip";

export { getRequestIp } from "./request-ip";

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

export type DurableRateLimitFailureMode = "memory-fallback" | "deny";

export type DurableRateLimitOptions = {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
  /**
   * Existing public callers degrade to per-instance memory by default. Auth
   * boundaries can opt into `deny` so a shared-store outage cannot reset the
   * effective attempt budget across instances.
   */
  failureMode?: DurableRateLimitFailureMode;
};

export type DurableRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export interface DurableRateLimitStore {
  increment(input: {
    bucketKey: string;
    expiresAtIso: string;
  }): Promise<number>;
  deleteExpired(): Promise<void>;
}

export interface DurableRateLimitDependencies {
  /** Test seam for deterministic store failures; production uses Neon. */
  store?: DurableRateLimitStore;
  now?: () => number;
  random?: () => number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();
const SWEEP_INTERVAL_MS = 60_000;
const MAX_KEYS_PER_SCOPE = 10_000;
let lastSweepAt = 0;

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

/**
 * Convenience wrapper: enforce a per-IP in-memory limit for a public GET
 * route and, when exceeded, return the standard 429 JSON `NextResponse`
 * (with `Retry-After` + `X-RateLimit-Remaining: 0`). Returns null when
 * the request is allowed, so callers do:
 *
 *   const limited = enforceInMemoryRateLimit(req, { scope: "countries-bills" });
 *   if (limited) return limited;
 *
 * This is the shared control the public per-country DB sub-routes use so
 * they match the hardened `/export` sibling. Defaults to 60/min/IP.
 */
export function enforceInMemoryRateLimit(
  request: Request,
  {
    scope,
    max = 60,
    windowMs = 60_000,
  }: { scope: string; max?: number; windowMs?: number },
): NextResponse | null {
  const { allowed, retryAfterSeconds } = checkInMemoryRateLimit({
    scope,
    key: getRequestIp(request),
    max,
    windowMs,
  });
  if (allowed) return null;
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
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
//   • Graceful degradation remains the default: DB errors fall back to the
//     in-memory limiter so existing public callers preserve their behavior.
//     Security-sensitive callers may opt into `failureMode: "deny"`, which
//     fails closed instead of silently losing cross-instance durability.

/** Run the expired-row sweep on ~1 in N calls (amortised cleanup). */
const DURABLE_CLEANUP_PROBABILITY = 0.02;

const postgresDurableRateLimitStore: DurableRateLimitStore = {
  async increment({ bucketKey, expiresAtIso }) {
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${bucketKey}, 1, ${expiresAtIso}::timestamptz)
      ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `);
    const row = result.rows[0] as { count: number | string } | undefined;
    return row ? Number(row.count) : 1;
  },

  async deleteExpired() {
    await db.execute(sql`DELETE FROM rate_limits WHERE expires_at < now()`);
  },
};

export async function checkDurableRateLimit(
  {
    scope,
    key,
    limit,
    windowMs,
    failureMode = "memory-fallback",
  }: DurableRateLimitOptions,
  dependencies: DurableRateLimitDependencies = {},
): Promise<DurableRateLimitResult> {
  const now = dependencies.now?.() ?? Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const bucketKey = `${scope}:${key}:${windowStart}`;
  const expiresAtIso = new Date(windowEnd).toISOString();
  const store = dependencies.store ?? postgresDurableRateLimitStore;

  try {
    // Atomic increment-and-read. INSERT seeds the window at 1; a concurrent
    // request on the same key conflicts and bumps the existing count by 1.
    const count = await store.increment({ bucketKey, expiresAtIso });

    // Opportunistic reap of expired windows — cheap (indexed) and rare.
    // Wrapped so a cleanup failure can never disturb the decision above.
    if (
      (dependencies.random?.() ?? Math.random()) < DURABLE_CLEANUP_PROBABILITY
    ) {
      try {
        await store.deleteExpired();
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
    if (failureMode === "deny") {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, windowEnd - now),
      };
    }

    // DB unreachable / transient error → degrade to the per-instance limiter
    // for callers retaining the historical default behavior.
    const fallback = checkInMemoryRateLimit({
      scope,
      key,
      max: limit,
      windowMs,
    });
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining,
      retryAfterMs: fallback.retryAfterSeconds * 1000,
    };
  }
}
