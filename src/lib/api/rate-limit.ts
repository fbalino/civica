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
