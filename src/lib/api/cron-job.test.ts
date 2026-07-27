import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { redirect } from "next/navigation";

import type {
  CronExecutionClaim,
  CronExecutionClaimInput,
  CronExecutionFinishInput,
  CronExecutionStore,
} from "./cron-execution-store";
import { cronExecutionKeyFromRequest, withCronJob } from "./cron-job";
import { cacheControlFor } from "@/lib/platform/cache-consistency";
import type { PipelineRunStore } from "@/lib/platform/pipeline-observability";

interface StoredExecution {
  jobId: string;
  requestSha256: string;
  status: "running" | "succeeded" | "failed";
  completedAt: Date | null;
  responseStatus: number | null;
  attemptCount: number;
}

interface StoredLease {
  fence: number;
  active: null | {
    executionKey: string;
    leaseToken: string;
    attemptId: string;
    expiresAt: Date;
  };
}

class MemoryCronExecutionStore implements CronExecutionStore {
  readonly executions = new Map<string, StoredExecution>();
  readonly leases = new Map<string, StoredLease>();
  acquireCalls = 0;
  finishCalls = 0;
  failFinish = false;

  constructor(private readonly now: () => Date = () => new Date()) {}

  async acquire(input: CronExecutionClaimInput): Promise<CronExecutionClaim> {
    this.acquireCalls++;
    const now = this.now();
    let lease = this.leases.get(input.jobId) ?? { fence: 0, active: null };

    if (lease.active && lease.active.expiresAt.getTime() > now.getTime()) {
      const activeExecution = this.executions.get(lease.active.executionKey);
      if (!activeExecution) throw new Error("seeded lease has no execution");
      if (
        lease.active.executionKey === input.executionKey &&
        activeExecution.requestSha256 !== input.requestSha256
      ) {
        return {
          state: "conflict",
          attemptCount: activeExecution.attemptCount,
        };
      }
      if (lease.active.executionKey !== input.executionKey) {
        return {
          state: "busy",
          leaseExpiresAt: lease.active.expiresAt,
        };
      }
      return {
        state: "running",
        leaseExpiresAt: lease.active.expiresAt,
        attemptCount: activeExecution.attemptCount,
      };
    }

    if (lease.active) {
      const abandoned = this.executions.get(lease.active.executionKey);
      if (abandoned?.status === "running") {
        this.executions.set(lease.active.executionKey, {
          ...abandoned,
          status: "failed",
          completedAt: now,
          responseStatus: 504,
        });
      }
      lease = { ...lease, active: null };
      this.leases.set(input.jobId, lease);
    }

    const existing = this.executions.get(input.executionKey);
    if (existing && existing.requestSha256 !== input.requestSha256) {
      return { state: "conflict", attemptCount: existing.attemptCount };
    }
    if (existing?.status === "succeeded") {
      return {
        state: "succeeded",
        completedAt: existing.completedAt!,
        responseStatus: existing.responseStatus!,
        attemptCount: existing.attemptCount,
      };
    }
    if (existing && existing.attemptCount >= input.maxAttempts) {
      return { state: "exhausted", attemptCount: existing.attemptCount };
    }

    const leaseToken = randomUUID();
    const attemptId = randomUUID();
    const leaseFence = lease.fence + 1;
    const leaseExpiresAt = new Date(now.getTime() + input.leaseMs);
    const attemptCount = (existing?.attemptCount ?? 0) + 1;
    this.executions.set(input.executionKey, {
      jobId: input.jobId,
      requestSha256: input.requestSha256,
      status: "running",
      completedAt: null,
      responseStatus: null,
      attemptCount,
    });
    this.leases.set(input.jobId, {
      fence: leaseFence,
      active: {
        executionKey: input.executionKey,
        leaseToken,
        attemptId,
        expiresAt: leaseExpiresAt,
      },
    });
    return {
      state: "acquired",
      leaseToken,
      leaseExpiresAt,
      attemptCount,
      attemptId,
      leaseFence,
    };
  }

  async finish(input: CronExecutionFinishInput): Promise<boolean> {
    this.finishCalls++;
    if (this.failFinish) throw new Error("seeded finish outage");
    const lease = this.leases.get(input.jobId);
    const active = lease?.active;
    if (
      !lease ||
      !active ||
      active.executionKey !== input.executionKey ||
      active.leaseToken !== input.leaseToken ||
      active.attemptId !== input.attemptId ||
      lease.fence !== input.leaseFence
    ) {
      return false;
    }
    const existing = this.executions.get(input.executionKey);
    if (!existing || existing.status !== "running") return false;
    this.executions.set(input.executionKey, {
      ...existing,
      status: input.status,
      completedAt: this.now(),
      responseStatus: input.responseStatus,
    });
    this.leases.set(input.jobId, { fence: lease.fence, active: null });
    return true;
  }
}

class MemoryPipelineRunStore implements PipelineRunStore {
  readonly starts: Parameters<PipelineRunStore["start"]>[0][] = [];
  readonly finishes: Parameters<PipelineRunStore["finish"]>[0][] = [];
  failStart = false;

  async start(input: Parameters<PipelineRunStore["start"]>[0]) {
    if (this.failStart) throw new Error("seeded pipeline-store outage");
    this.starts.push(input);
    return { id: input.id, startedAt: input.startedAt };
  }

  async finish(input: Parameters<PipelineRunStore["finish"]>[0]) {
    this.finishes.push(input);
  }
}

const FIXED_NOW = new Date("2026-07-14T08:05:00.000Z");
const ORIGINAL_SECRET = process.env.CRON_SECRET;

function request(
  path = "/api/cron/pulse/v2/ingest",
  options: {
    secret?: string;
    method?: string;
    headers?: HeadersInit;
  } = {},
): Request {
  const headers = new Headers(options.headers);
  if (options.secret !== undefined) {
    headers.set("authorization", `Bearer ${options.secret}`);
  }
  return new Request(`https://civicaatlas.org${path}`, {
    method: options.method ?? "GET",
    headers,
  });
}

function directClaim(
  overrides: Partial<CronExecutionClaimInput> = {},
): CronExecutionClaimInput {
  return {
    executionKey:
      "8f4d7a61d63b13c9fd604a8fd4bb7fd867e8d7eb908f1a431235e0af4700ebaf",
    jobId: "pulse.v2.ingest",
    route: "/api/cron/pulse/v2/ingest",
    triggerKind: "scheduled",
    scheduleSlot: FIXED_NOW,
    requestMode: "apply",
    scopeKey: null,
    requestSha256:
      "4e9000fdcc589951af02784cb5df2198e2e62b73226676a08c1542a4e6a9bf1b",
    leaseMs: 30 * 60_000,
    maxAttempts: 3,
    ...overrides,
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = "correct-cron-secret";
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

test("missing and wrong secrets fail before delivery-control access", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true }),
    { store, now: () => FIXED_NOW },
  );

  assert.equal((await guarded(request())).status, 401);
  assert.equal(
    (await guarded(request(undefined, { secret: "wrong" }))).status,
    401,
  );
  assert.equal(store.acquireCalls, 0);
});

test("framework redirects escape the cron handler error boundary", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    async () => redirect("/admin"),
    { store, now: () => FIXED_NOW },
  );
  await assert.rejects(
    () =>
      Promise.resolve(
        guarded(request(undefined, { secret: "correct-cron-secret" })),
      ),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT"),
  );
});

test("every POST and every parameterized GET requires an Idempotency-Key", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true }),
    { store, now: () => FIXED_NOW },
  );

  const post = await guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "user-agent": "vercel-cron/1.0" },
    }),
  );
  assert.equal(post.status, 400);
  const parameterizedGet = await guarded(
    request("/api/cron/pulse/v2/ingest?dryRun=1", {
      secret: "correct-cron-secret",
    }),
  );
  assert.equal(parameterizedGet.status, 400);
  assert.equal(store.acquireCalls, 0);

  const valid = await guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "repair-2026-07-14-a" },
    }),
  );
  assert.equal(valid.status, 200);
});

test("invalid idempotency keys are rejected before database access", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true }),
    { store, now: () => FIXED_NOW },
  );
  const response = await guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "contains a space" },
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(store.acquireCalls, 0);
});

test("unknown cron input returns one safe non-cacheable problem before lease", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );

  const response = await guarded(
    request("/api/cron/pulse/v2/ingest?secretField=do-not-reflect", {
      secret: "correct-cron-secret",
      headers: { "idempotency-key": "invalid-input" },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(
    response.headers.get("cache-control"),
    cacheControlFor("private-live"),
  );
  assert.deepEqual(await response.json(), {
    ok: false,
    jobId: "pulse.v2.ingest",
    outcome: "invalid_request",
    code: "unknown_query_parameter",
  });
  assert.equal(store.acquireCalls, 0);
  assert.equal(handlerCalls, 0);
});

test("a completed delivery suppresses a sequential duplicate", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true, step: "pulse.v2.ingest" });
    },
    { store, now: () => FIXED_NOW },
  );

  assert.equal(
    (await guarded(request(undefined, { secret: "correct-cron-secret" })))
      .status,
    200,
  );
  const duplicate = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).outcome, "duplicate_suppressed");
  assert.equal(handlerCalls, 1);
});

test("successful cron responses override every public cache header", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () =>
      Response.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "CDN-Cache-Control": "public, max-age=3600",
            "Vercel-CDN-Cache-Control": "public, max-age=3600",
          },
        },
      ),
    { store, now: () => FIXED_NOW },
  );

  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("cache-control"),
    cacheControlFor("private-live"),
  );
  assert.equal(response.headers.get("cdn-cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
});

test("the job-wide lease rejects an unrecorded concurrent delivery with a different key", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => {
    release = resolve;
  });
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    async () => {
      handlerCalls++;
      await blocker;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );

  const first = guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "manual-a" },
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  const concurrent = await guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "manual-b" },
    }),
  );
  assert.equal(concurrent.status, 503);
  assert.deepEqual(await concurrent.json(), {
    ok: false,
    jobId: "pulse.v2.ingest",
    outcome: "job_busy",
    jobStarted: false,
    deliveryRecorded: false,
  });
  assert.equal(handlerCalls, 1);
  assert.equal(store.executions.size, 1);
  assert.equal(
    [...store.executions.values()].filter(({ status }) => status === "running")
      .length,
    1,
  );
  release();
  assert.equal((await first).status, 200);
});

test("a duplicate of the same running delivery remains an explicit 202", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => {
    release = resolve;
  });
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    async () => {
      handlerCalls++;
      await blocker;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );

  const makeRequest = () =>
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "same-running-delivery" },
    });
  const first = guarded(makeRequest());
  await new Promise((resolve) => setImmediate(resolve));
  const duplicate = await guarded(makeRequest());

  assert.equal(duplicate.status, 202);
  assert.equal((await duplicate.json()).outcome, "job_in_progress");
  assert.equal(handlerCalls, 1);
  release();
  assert.equal((await first).status, 200);
});

test("changed inputs on the same running delivery key conflict before the handler", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => {
    release = resolve;
  });
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    async () => {
      handlerCalls++;
      await blocker;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );
  const common = {
    secret: "correct-cron-secret",
    method: "POST",
    headers: { "idempotency-key": "running-input-conflict" },
  };

  const first = guarded(request("/api/cron/pulse/v2/ingest?dryRun=1", common));
  await new Promise((resolve) => setImmediate(resolve));
  const conflict = await guarded(request("/api/cron/pulse/v2/ingest", common));

  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).outcome, "idempotency_key_conflict");
  assert.equal(handlerCalls, 1);
  release();
  assert.equal((await first).status, 200);
});

test("a failed delivery retries with the same key up to success", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return handlerCalls === 1
        ? Response.json({ ok: false }, { status: 502 })
        : Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );

  assert.equal(
    (await guarded(request(undefined, { secret: "correct-cron-secret" })))
      .status,
    502,
  );
  assert.equal(
    (await guarded(request(undefined, { secret: "correct-cron-secret" })))
      .status,
    200,
  );
  assert.equal(handlerCalls, 2);
  assert.equal([...store.executions.values()][0].attemptCount, 2);
});

test("the cron boundary retains a safe failed pipeline run before retrying", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const pipelineStore = new MemoryPipelineRunStore();
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () =>
      Response.json(
        { ok: false, outcome: "upstream_timeout", rowsRead: 12, totalWritten: 0, errorCount: 1 },
        { status: 502 },
      ),
    { store, pipelineStore, now: () => FIXED_NOW },
  );

  assert.equal(
    (await guarded(request(undefined, { secret: "correct-cron-secret" }))).status,
    502,
  );
  assert.equal(pipelineStore.starts.length, 1);
  assert.equal(pipelineStore.starts[0].pipelineId, "pulse.v2.ingest");
  assert.match(pipelineStore.starts[0].executionKey!, /^[a-f0-9]{64}$/);
  assert.equal(pipelineStore.finishes.length, 1);
  assert.equal(pipelineStore.finishes[0].status, "failed");
  assert.deepEqual(pipelineStore.finishes[0].metrics, {
    rowsRead: 12,
    rowsWritten: 0,
    rowsRejected: 1,
    costMicrousd: null,
  });
  assert.equal(pipelineStore.finishes[0].errorSummary, "upstream_timeout");
});

test("a pipeline-observability start outage records a retryable failed delivery", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const pipelineStore = new MemoryPipelineRunStore();
  pipelineStore.failStart = true;
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, pipelineStore, now: () => FIXED_NOW },
  );

  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).outcome, "pipeline_observability_unavailable");
  assert.equal(handlerCalls, 0);
  assert.equal(store.finishCalls, 1);
  assert.equal([...store.executions.values()][0].status, "failed");
});

test("the boundary injects one stable delivery key and overwrites a spoof", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const seen: string[] = [];
  const guarded = withCronJob(
    "pulse.v2.ingest",
    (handlerRequest) => {
      seen.push(cronExecutionKeyFromRequest(handlerRequest));
      return Response.json(
        { ok: seen.length > 1 },
        { status: seen.length > 1 ? 200 : 502 },
      );
    },
    { store, now: () => FIXED_NOW },
  );
  const spoofed = request(undefined, {
    secret: "correct-cron-secret",
    headers: { "x-civica-cron-execution-key": "a".repeat(64) },
  });

  assert.equal((await guarded(spoofed)).status, 502);
  assert.equal(
    (
      await guarded(
        request(undefined, {
          secret: "correct-cron-secret",
          headers: { "x-civica-cron-execution-key": "b".repeat(64) },
        }),
      )
    ).status,
    200,
  );
  assert.equal(seen.length, 2);
  assert.equal(seen[0], seen[1]);
  assert.match(seen[0], /^[a-f0-9]{64}$/);
  assert.notEqual(seen[0], "a".repeat(64));
  assert.notEqual(seen[1], "b".repeat(64));
});

test("the retry cap makes a repeatedly failing delivery terminal", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: false }, { status: 502 });
    },
    { store, now: () => FIXED_NOW },
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    assert.equal(
      (await guarded(request(undefined, { secret: "correct-cron-secret" })))
        .status,
      502,
    );
  }
  const exhausted = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(exhausted.status, 503);
  assert.equal((await exhausted.json()).outcome, "retry_limit_exhausted");
  assert.equal(handlerCalls, 3);
});

test("an expired attempt is reclaimed and its stale fence cannot finish", async () => {
  let now = new Date(FIXED_NOW);
  const store = new MemoryCronExecutionStore(() => now);
  const first = await store.acquire(directClaim());
  assert.equal(first.state, "acquired");
  if (first.state !== "acquired") return;

  now = new Date(FIXED_NOW.getTime() + 31 * 60_000);
  const second = await store.acquire(directClaim());
  assert.equal(second.state, "acquired");
  if (second.state !== "acquired") return;
  assert.equal(second.attemptCount, 2);
  assert.equal(second.leaseFence, first.leaseFence + 1);

  assert.equal(
    await store.finish({
      executionKey: directClaim().executionKey,
      jobId: directClaim().jobId,
      leaseToken: first.leaseToken,
      attemptId: first.attemptId,
      leaseFence: first.leaseFence,
      status: "succeeded",
      responseStatus: 200,
      resultCode: "handler_succeeded",
    }),
    false,
  );
  assert.equal(
    await store.finish({
      executionKey: directClaim().executionKey,
      jobId: directClaim().jobId,
      leaseToken: second.leaseToken,
      attemptId: second.attemptId,
      leaseFence: second.leaseFence,
      status: "succeeded",
      responseStatus: 200,
      resultCode: "handler_succeeded",
    }),
    true,
  );
});

test("the current holder may finish after expiry until a takeover occurs", async () => {
  let now = new Date(FIXED_NOW);
  const store = new MemoryCronExecutionStore(() => now);
  const claim = await store.acquire(directClaim());
  assert.equal(claim.state, "acquired");
  if (claim.state !== "acquired") return;

  now = new Date(FIXED_NOW.getTime() + 31 * 60_000);
  assert.equal(
    await store.finish({
      executionKey: directClaim().executionKey,
      jobId: directClaim().jobId,
      leaseToken: claim.leaseToken,
      attemptId: claim.attemptId,
      leaseFence: claim.leaseFence,
      status: "succeeded",
      responseStatus: 200,
      resultCode: "handler_succeeded",
    }),
    true,
  );
});

test("reusing one idempotency key with changed query parameters conflicts", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );
  const options = {
    secret: "correct-cron-secret",
    method: "POST",
    headers: { "idempotency-key": "same-key" },
  };
  assert.equal(
    (await guarded(request("/api/cron/pulse/v2/ingest?dryRun=1", options)))
      .status,
    200,
  );
  const conflict = await guarded(request("/api/cron/pulse/v2/ingest", options));
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).outcome, "idempotency_key_conflict");
  assert.equal(handlerCalls, 1);
});

test("canonical query ordering does not create a false conflict", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "factbook.auto-resolve",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );
  const options = {
    secret: "correct-cron-secret",
    method: "POST",
    headers: { "idempotency-key": "canonical-order" },
  };
  await guarded(
    request(
      "/api/cron/factbook/auto-resolve-disputes?limit=5&dryRun=1",
      options,
    ),
  );
  const duplicate = await guarded(
    request(
      "/api/cron/factbook/auto-resolve-disputes?dryRun=1&limit=5",
      options,
    ),
  );
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).outcome, "duplicate_suppressed");
  assert.equal(handlerCalls, 1);
});

test("duplicate query values fail before lease acquisition", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );
  const options = {
    secret: "correct-cron-secret",
    headers: { "idempotency-key": "duplicate-value-order" },
  };

  const first = await guarded(
    request("/api/cron/pulse/v2/ingest?dryRun=1&dryRun=1", options),
  );
  const second = await guarded(
    request("/api/cron/pulse/v2/ingest?dryRun=1&dryRun=1", options),
  );

  assert.equal(first.status, 400);
  assert.equal((await first.json()).code, "duplicate_query_parameter");
  assert.equal(second.status, 400);
  assert.equal(store.acquireCalls, 0);
  assert.equal(handlerCalls, 0);
});

test("a manual idempotency key remains stable across schedule slots", async () => {
  let now = new Date(FIXED_NOW);
  const store = new MemoryCronExecutionStore(() => now);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => now },
  );
  const options = {
    secret: "correct-cron-secret",
    method: "POST",
    headers: { "idempotency-key": "durable-manual-key" },
  };

  await guarded(request(undefined, options));
  now = new Date("2026-07-16T08:05:00.000Z");
  const duplicate = await guarded(request(undefined, options));
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).outcome, "duplicate_suppressed");
  assert.equal(handlerCalls, 1);
});

test("a 2xx body with ok false is finalized as failure", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: false, reason: "partial" }),
    { store, now: () => FIXED_NOW },
  );

  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(response.status, 500);
  assert.equal([...store.executions.values()][0].status, "failed");
});

test("a non-2xx body cannot retain ok true", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true, reason: "failed" }, { status: 502 }),
    { store, now: () => FIXED_NOW },
  );
  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
  assert.equal([...store.executions.values()][0].status, "failed");
});

test("a finalization outage never exposes an unrecorded success", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  store.failFinish = true;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true }),
    { store, now: () => FIXED_NOW },
  );

  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret" }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).outcome, "delivery_finalization_failed");
});

test("dry-run and apply deliveries cannot suppress one another", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  let handlerCalls = 0;
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => {
      handlerCalls++;
      return Response.json({ ok: true });
    },
    { store, now: () => FIXED_NOW },
  );
  await guarded(
    request("/api/cron/pulse/v2/ingest?dryRun=1", {
      secret: "correct-cron-secret",
      headers: { "idempotency-key": "manual-dry-run" },
    }),
  );
  await guarded(
    request(undefined, {
      secret: "correct-cron-secret",
      method: "POST",
      headers: { "idempotency-key": "manual-apply" },
    }),
  );
  assert.equal(handlerCalls, 2);
  assert.equal(store.executions.size, 2);
});

test("unsupported methods fail before database access", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v2.ingest",
    () => Response.json({ ok: true }),
    { store, now: () => FIXED_NOW },
  );
  const response = await guarded(
    request(undefined, { secret: "correct-cron-secret", method: "PUT" }),
  );
  assert.equal(response.status, 405);
  assert.equal(store.acquireCalls, 0);
});

test("retired cron routes share auth but need no database lease", async () => {
  const store = new MemoryCronExecutionStore(() => FIXED_NOW);
  const guarded = withCronJob(
    "pulse.v1.ingest",
    () => Response.json({ ok: false, retired: true }, { status: 410 }),
    { store, now: () => FIXED_NOW },
  );
  const response = await guarded(
    request("/api/cron/pulse/ingest", { secret: "correct-cron-secret" }),
  );
  assert.equal(response.status, 410);
  assert.equal(store.acquireCalls, 0);
});
