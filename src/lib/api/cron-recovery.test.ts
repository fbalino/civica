import assert from "node:assert/strict";
import test from "node:test";

import {
  CRON_RECOVERY_BATCH_SIZE,
  CRON_RECOVERY_DISPATCH_TIMEOUT_MS,
  CRON_RECOVERY_EXECUTION_HEADER,
  dispatchDueCronRecoveries,
  recoveryCandidate,
  type CronRecoveryCandidate,
  type CronRecoveryRow,
  type CronRecoveryStore,
} from "./cron-recovery";

const NOW = new Date("2026-09-17T12:00:00.000Z");
const EXECUTION_KEY = "a".repeat(64);

function row(overrides: Partial<CronRecoveryRow> = {}): CronRecoveryRow {
  return {
    executionKey: EXECUTION_KEY,
    jobId: "bills.ca",
    route: "/api/cron/bills/ca",
    scheduleSlot: new Date("2026-09-17T04:00:00.000Z"),
    status: "failed",
    attemptCount: 1,
    maxAttempts: 3,
    completedAt: new Date("2026-09-17T11:45:00.000Z"),
    responseStatus: 503,
    resultCode: "upstream_unavailable",
    leaseExecutionKey: null,
    leaseExpiresAt: null,
    ...overrides,
  };
}

test("transient failures become due only after bounded backoff", () => {
  assert.equal(
    recoveryCandidate(row(), new Date("2026-09-17T11:59:59.999Z")),
    null,
  );
  const firstRetry = recoveryCandidate(row(), NOW);
  assert.equal(firstRetry?.reason, "transient_failure");
  assert.equal(firstRetry?.attemptCount, 1);

  const secondAttempt = row({
    attemptCount: 2,
    completedAt: new Date("2026-09-17T11:00:00.000Z"),
  });
  assert.equal(
    recoveryCandidate(
      secondAttempt,
      new Date("2026-09-17T11:59:59.999Z"),
    ),
    null,
  );
  assert.equal(
    recoveryCandidate(
      row({
        jobId: "factbook.wikidata",
        route: "/api/cron/factbook/sync-wikidata",
      }),
      NOW,
    ),
    null,
  );
  assert.equal(
    recoveryCandidate(
      row({
        jobId: "factbook.officeholders",
        route: "/api/cron/factbook/sync-officeholders",
      }),
      NOW,
    ),
    null,
  );
  assert.equal(recoveryCandidate(secondAttempt, NOW)?.attemptCount, 2);
});

test("retry cap and deterministic failures never enter automatic recovery", () => {
  assert.equal(recoveryCandidate(row({ attemptCount: 3 }), NOW), null);
  assert.equal(
    recoveryCandidate(
      row({ responseStatus: 500, resultCode: "handler_exception" }),
      NOW,
    ),
    null,
  );
  assert.equal(
    recoveryCandidate(row({ responseStatus: 502, resultCode: "partial" }), NOW),
    null,
  );
  assert.equal(
    recoveryCandidate(
      row({
        jobId: "pulse.v2.classify",
        route: "/api/cron/pulse/v2/classify",
      }),
      NOW,
    ),
    null,
  );
  assert.equal(
    recoveryCandidate(
      row({
        jobId: "pulse.v2.cluster",
        route: "/api/cron/pulse/v2/cluster",
      }),
      NOW,
    ),
    null,
  );
  assert.equal(
    recoveryCandidate(
      row({
        jobId: "operations.pipeline-alerts",
        route: "/api/cron/operations/pipeline-alerts",
      }),
      NOW,
    ),
    null,
  );
});

test("only an expired matching lease makes a running attempt recoverable", () => {
  const running = row({
    status: "running",
    completedAt: null,
    responseStatus: null,
    resultCode: null,
    leaseExecutionKey: EXECUTION_KEY,
    leaseExpiresAt: new Date("2026-09-17T11:59:59.000Z"),
  });
  assert.equal(recoveryCandidate(running, NOW)?.reason, "expired_attempt");
  assert.equal(
    recoveryCandidate(
      { ...running, leaseExpiresAt: new Date("2026-09-17T12:00:01.000Z") },
      NOW,
    ),
    null,
  );
  assert.equal(
    recoveryCandidate({ ...running, leaseExecutionKey: "b".repeat(64) }, NOW),
    null,
  );
});

class CandidateStore implements CronRecoveryStore {
  constructor(readonly candidates: CronRecoveryCandidate[]) {}
  async listDue() {
    return this.candidates;
  }
  async resolveDue() {
    return null;
  }
}

function candidate(
  index: number,
  overrides: Partial<CronRecoveryCandidate> = {},
): CronRecoveryCandidate {
  return {
    executionKey: index.toString(16).padStart(64, "0"),
    jobId: "bills.ca",
    route: "/api/cron/bills/ca",
    scheduleSlot: new Date("2026-09-17T04:00:00.000Z"),
    attemptCount: 1,
    dueAt: NOW,
    reason: "transient_failure",
    ...overrides,
  };
}

test("dispatcher is batch-bounded and keeps auth on the canonical route", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await dispatchDueCronRecoveries({
    now: NOW,
    store: new CandidateStore(
      [
        candidate(1),
        candidate(2, { jobId: "bills.de", route: "/api/cron/bills/de" }),
        candidate(3, { jobId: "bills.fr", route: "/api/cron/bills/fr" }),
        candidate(4, { jobId: "bills.br", route: "/api/cron/bills/br" }),
        candidate(5, { jobId: "bills.uk", route: "/api/cron/bills/uk" }),
        candidate(6, { jobId: "bills.us", route: "/api/cron/bills/us" }),
      ],
    ),
    cronSecret: "test-secret",
    fetcher: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 202 });
    }) as typeof fetch,
  });

  assert.equal(calls.length, CRON_RECOVERY_BATCH_SIZE);
  assert.deepEqual(result, {
    checked: CRON_RECOVERY_BATCH_SIZE,
    dispatched: CRON_RECOVERY_BATCH_SIZE,
    completed: CRON_RECOVERY_BATCH_SIZE,
    retrySucceeded: CRON_RECOVERY_BATCH_SIZE,
    retryFailed: 0,
    transportFailed: 0,
  });
  const expectedRoutes = [
    "/api/cron/bills/ca",
    "/api/cron/bills/de",
    "/api/cron/bills/fr",
    "/api/cron/bills/br",
  ];
  for (const [index, call] of calls.entries()) {
    const url = new URL(call.url);
    assert.equal(url.origin, "https://civicaatlas.org");
    assert.equal(url.pathname, expectedRoutes[index]);
    assert.equal(url.search, "");
    assert.equal(call.init?.redirect, "manual");
    assert.equal(call.init?.signal?.aborted, false);
    assert.equal(
      CRON_RECOVERY_DISPATCH_TIMEOUT_MS,
      650_000,
    );
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-secret");
    assert.equal(
      headers.get(CRON_RECOVERY_EXECUTION_HEADER),
      (index + 1).toString(16).padStart(64, "0"),
    );
  }
});

test("dispatcher sends at most one concurrent recovery per job", async () => {
  let calls = 0;
  const result = await dispatchDueCronRecoveries({
    now: NOW,
    store: new CandidateStore([candidate(1), candidate(2)]),
    cronSecret: "test-secret",
    fetcher: (async () => {
      calls++;
      return new Response(null, { status: 202 });
    }) as typeof fetch,
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    checked: 1,
    dispatched: 1,
    completed: 1,
    retrySucceeded: 1,
    retryFailed: 0,
    transportFailed: 0,
  });
});

test("dispatcher rejects a target that could escape the canonical origin", async () => {
  let fetchCalls = 0;
  const malicious = { ...candidate(1), route: "//example.net/api/cron/bills/ca" };
  const result = await dispatchDueCronRecoveries({
    now: NOW,
    store: new CandidateStore([malicious]),
    cronSecret: "test-secret",
    fetcher: (async () => {
      fetchCalls++;
      return new Response(null, { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(fetchCalls, 0);
  assert.deepEqual(result, {
    checked: 1,
    dispatched: 1,
    completed: 0,
    retrySucceeded: 0,
    retryFailed: 0,
    transportFailed: 1,
  });
});

test("dispatcher separates a completed failed retry from a transport outage", async () => {
  let calls = 0;
  const result = await dispatchDueCronRecoveries({
    now: NOW,
    store: new CandidateStore([
      candidate(1),
      candidate(2, { jobId: "bills.de", route: "/api/cron/bills/de" }),
    ]),
    cronSecret: "test-secret",
    fetcher: (async () => {
      calls++;
      if (calls === 1) return new Response(null, { status: 503 });
      throw new Error("transport unavailable");
    }) as typeof fetch,
  });
  assert.deepEqual(result, {
    checked: 2,
    dispatched: 2,
    completed: 1,
    retrySucceeded: 0,
    retryFailed: 1,
    transportFailed: 1,
  });
});
