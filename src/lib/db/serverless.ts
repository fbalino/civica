/**
 * PLT-023 — Neon HTTP transport contract for request-serving code.
 *
 * The driver issues one HTTP request per query or non-interactive batch. This
 * wrapper intentionally does not retry: after a transport failure the server
 * cannot know whether a write committed. Durable cron idempotency owns any
 * later replay; ordinary reads surface their failure to the caller.
 */

export const SERVERLESS_DB_OPERATION_CONTRACT_VERSION =
  "civica-serverless-db-http/v1" as const;
export const SERVERLESS_DB_HTTP_TIMEOUT_MS = 10_000;

export type ServerlessDbFetch = typeof fetch;

function assertTimeout(timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Serverless database timeout must be a whole number from 1 through 60000 ms");
  }
}

/**
 * Give every Neon HTTP request a fresh timeout while preserving cancellation
 * supplied by the caller. There is deliberately no retry loop here.
 */
export function createBoundedServerlessDbFetch(
  fetchImpl: ServerlessDbFetch = globalThis.fetch,
  timeoutMs = SERVERLESS_DB_HTTP_TIMEOUT_MS,
): ServerlessDbFetch {
  assertTimeout(timeoutMs);
  return async (input, init) => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const abortForCaller = () => controller.abort(callerSignal?.reason);
    if (callerSignal?.aborted) abortForCaller();
    else callerSignal?.addEventListener("abort", abortForCaller, { once: true });

    const timeout = setTimeout(
      () => controller.abort(new Error("Serverless database request timed out")),
      timeoutMs,
    );
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortForCaller);
    }
  };
}
