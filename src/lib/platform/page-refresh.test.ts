import assert from "node:assert/strict";
import test from "node:test";

import {
  PAGE_REFRESH_TOTAL_BUDGET_MS,
  PAGE_WARM_BUDGET_MS,
  PAGE_WARM_CONCURRENCY,
  PAGE_WARM_MIN_SLOT_MS,
  PAGE_WARM_REQUEST_TIMEOUT_MS,
  pageRefreshOutcome,
  pageWarmTargets,
  refreshPages,
  warmPages,
  type PageWarmTarget,
} from "./page-refresh";

const ORIGIN = "https://civicaatlas.org";

test("warm targets keep cacheable same-origin pages in priority order", () => {
  const targets = pageWarmTargets(
    [
      { url: `${ORIGIN}/country/france/constitution`, priority: 0.7 },
      { url: `${ORIGIN}/`, priority: 1 },
      { url: `${ORIGIN}/country/france`, priority: 0.9 },
      { url: `${ORIGIN}/country/france/`, priority: 0.4 },
      { url: `${ORIGIN}/compare?c=france&c=spain`, priority: 0.6 },
      { url: `${ORIGIN}/compare`, priority: 0.6 },
      { url: `${ORIGIN}/atlas`, priority: 0.95 },
      { url: `${ORIGIN}/admin/messages`, priority: 0.1 },
      { url: "https://example.test/country/france", priority: 1 },
      { url: "not a url", priority: 1 },
      { url: `${ORIGIN}/blog/a-post` },
    ],
    ORIGIN,
  );
  assert.deepEqual(
    targets.map(({ path, priority }) => [path, priority]),
    [
      ["/", 1],
      ["/country/france", 0.9],
      ["/country/france/constitution", 0.7],
      ["/blog/a-post", 0.5],
    ],
  );
  assert.equal(targets[1]!.url, `${ORIGIN}/country/france`);
});

function target(path: string): PageWarmTarget {
  return { url: `${ORIGIN}${path}`, path, priority: 0.5 };
}

function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
  };
}

test("warm-up bounds concurrency, paces each slot, and counts outcomes", async () => {
  const clock = fakeClock();
  let inFlight = 0;
  let maxInFlight = 0;
  const seen: string[] = [];
  const statuses: Record<string, number> = {
    "/a": 200,
    "/b": 404,
    "/c": 200,
    "/d": 308,
    "/e": 200,
  };
  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    seen.push(path);
    assert.equal(init?.redirect, "manual");
    assert.equal(init?.cache, "no-store");
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    clock.advance(100);
    inFlight -= 1;
    if (path === "/f") throw new TypeError("fetch failed");
    return new Response("ok", { status: statuses[path] ?? 200 });
  }) as typeof fetch;

  const result = await warmPages(
    ["/a", "/b", "/c", "/d", "/e", "/f"].map(target),
    { fetcher, now: clock.now, sleep: clock.sleep, concurrency: 2, minSlotMs: 1_000 },
  );

  assert.equal(maxInFlight, 2);
  assert.deepEqual(seen.sort(), ["/a", "/b", "/c", "/d", "/e", "/f"]);
  assert.deepEqual(
    { ...result, durationMs: undefined, failedPaths: [...result.failedPaths].sort() },
    {
      targets: 6,
      attempted: 6,
      warmed: 3,
      failed: 3,
      skipped: 0,
      durationMs: undefined,
      failureStatuses: { "404": 1, "308": 1, network: 1 },
      staleTargets: [],
      failedPaths: ["/b", "/d", "/f"],
    },
  );
  // Six one-second slots over two workers.
  assert.equal(result.durationMs, 3_000);
});

test("warm-up stops starting requests once the budget is spent", async () => {
  const clock = fakeClock();
  const fetcher = (async () => {
    clock.advance(400);
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  const result = await warmPages(
    ["/a", "/b", "/c", "/d", "/e"].map(target),
    {
      fetcher,
      now: clock.now,
      sleep: clock.sleep,
      concurrency: 1,
      minSlotMs: 1_000,
      budgetMs: 2_500,
    },
  );
  assert.equal(result.attempted, 3);
  assert.equal(result.warmed, 3);
  assert.equal(result.skipped, 2);
});

test("a timed-out request is a failure, not a crash", async () => {
  const fetcher = (async () => {
    const error = new Error("timed out");
    error.name = "TimeoutError";
    throw error;
  }) as typeof fetch;
  const result = await warmPages([target("/slow")], {
    fetcher,
    sleep: async () => {},
  });
  assert.deepEqual(result.failureStatuses, { timeout: 1 });
  assert.equal(result.warmed, 0);
});

test("the production warm-up fits its function limit with room to finalize", () => {
  // maxDuration is 800s; the last request may start just before the budget.
  assert.ok(PAGE_WARM_BUDGET_MS < PAGE_REFRESH_TOTAL_BUDGET_MS);
  assert.ok(PAGE_REFRESH_TOTAL_BUDGET_MS + PAGE_WARM_REQUEST_TIMEOUT_MS <= 700_000);
  // At most two renders start per second: well under the 600/minute firewall.
  assert.ok((PAGE_WARM_CONCURRENCY * 1_000) / PAGE_WARM_MIN_SLOT_MS <= 2);
});

test("a page still stale after the refresh is a reported failure", async () => {
  const clock = fakeClock();
  const calls = new Map<string, number>();
  // "/broken" keeps failing its background re-render, so the cache answers
  // STALE on both passes; "/slow" re-renders in the background and is a HIT
  // on the verification pass; "/fresh" rendered in the foreground.
  const fetcher = (async (url: string | URL) => {
    const path = new URL(String(url)).pathname;
    const call = (calls.get(path) ?? 0) + 1;
    calls.set(path, call);
    clock.advance(50);
    const status =
      path === "/broken" ? "STALE" : path === "/slow" && call === 1 ? "STALE" : "HIT";
    return new Response("ok", { status: 200, headers: { "x-vercel-cache": status } });
  }) as typeof fetch;

  const report = await refreshPages(["/fresh", "/slow", "/broken"].map(target), {
    fetcher,
    now: clock.now,
    sleep: clock.sleep,
    concurrency: 1,
    minSlotMs: 100,
  });
  assert.equal(calls.get("/fresh"), 1);
  assert.equal(calls.get("/slow"), 2);
  assert.equal(calls.get("/broken"), 2);
  assert.equal(report.staleAfterRefresh, 1);
  assert.equal(report.warmed, 2);
  assert.deepEqual(report.failedPaths, ["/broken"]);
  assert.equal(report.failureStatuses.stale, 1);
});

test("a server error during warm-up is counted, reported, and can fail the run", async () => {
  const fetcher = (async (url: string | URL) =>
    new Response("error", {
      status: new URL(String(url)).pathname === "/down" ? 503 : 200,
    })) as typeof fetch;
  const report = await refreshPages(["/a", "/down"].map(target), {
    fetcher,
    sleep: async () => {},
  });
  assert.equal(report.failed, 1);
  assert.deepEqual(report.failureStatuses, { "503": 1 });
  assert.deepEqual(report.failedPaths, ["/down"]);
  assert.deepEqual(pageRefreshOutcome(report), {
    ok: false,
    outcome: "pages_not_refreshed",
    httpStatus: 502,
    pagesFailed: 1,
  });
});

test("the run succeeds while failures stay within 1% of attempted pages", () => {
  const base = {
    targets: 829,
    attempted: 829,
    skipped: 0,
    unverified: 0,
    durationMs: 1,
    failureStatuses: {},
    failedPaths: [],
  };
  assert.equal(
    pageRefreshOutcome({ ...base, warmed: 821, failed: 6, staleAfterRefresh: 2 }).ok,
    true,
  );
  assert.equal(
    pageRefreshOutcome({ ...base, warmed: 820, failed: 6, staleAfterRefresh: 3 }).outcome,
    "pages_not_refreshed",
  );
  assert.equal(
    pageRefreshOutcome({ ...base, warmed: 0, failed: 829, staleAfterRefresh: 0 }).outcome,
    "warm_unavailable",
  );
});
