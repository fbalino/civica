import assert from "node:assert/strict";
import test from "node:test";

import {
  createBoundedServerlessDbFetch,
  SERVERLESS_DB_HTTP_TIMEOUT_MS,
  SERVERLESS_DB_OPERATION_CONTRACT_VERSION,
} from "./serverless";

test("serverless database fetch cancels a stalled HTTP request", async () => {
  let sawAbort = false;
  const stalled = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          sawAbort = true;
          reject(init.signal?.reason);
        },
        { once: true },
      );
    })) as typeof fetch;
  const fetchWithTimeout = createBoundedServerlessDbFetch(stalled, 1);

  await assert.rejects(
    () => fetchWithTimeout("https://database.invalid/sql"),
    /timed out/,
  );
  assert.equal(sawAbort, true);
});

test("serverless database transport never retries an uncertain request", async () => {
  let attempts = 0;
  const transientFailure = (async () => {
    attempts++;
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const fetchOnce = createBoundedServerlessDbFetch(transientFailure, 100);

  await assert.rejects(() => fetchOnce("https://database.invalid/sql"), /fetch failed/);
  assert.equal(attempts, 1);
});

test("serverless database fetch preserves caller cancellation", async () => {
  const caller = new AbortController();
  const stalled = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
        once: true,
      });
    })) as typeof fetch;
  const fetchWithTimeout = createBoundedServerlessDbFetch(stalled, 100);
  const request = fetchWithTimeout("https://database.invalid/sql", {
    signal: caller.signal,
  });
  caller.abort(new Error("caller cancelled"));

  await assert.rejects(request, /caller cancelled/);
});

test("serverless database timeout remains a bounded operational constant", () => {
  assert.equal(SERVERLESS_DB_HTTP_TIMEOUT_MS, 10_000);
  assert.equal(SERVERLESS_DB_OPERATION_CONTRACT_VERSION, "civica-serverless-db-http/v1");
});
