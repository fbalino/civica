import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { requireCronAuth } from "./cron-auth";
import { validateCronInput } from "./cron-input";
import {
  MAX_CRON_ATTEMPTS,
  type CronExecutionStore,
  postgresCronExecutionStore,
} from "./cron-execution-store";
import { CRON_JOB_LEASE_MS, getCronJobDefinition } from "./cron-job-registry";
import { latestCronScheduleSlot } from "./cron-schedule";

const IDEMPOTENCY_HEADER = "idempotency-key";
const INTERNAL_EXECUTION_KEY_HEADER = "x-civica-cron-execution-key";

export type CronRouteHandler = (
  request: Request,
) => Response | Promise<Response>;

interface CronJobDependencies {
  now?: () => Date;
  store?: CronExecutionStore;
}

interface CronJobFixtureContext {
  store: CronExecutionStore;
  handler: (jobId: string, request: Request) => Response | Promise<Response>;
}

const cronJobFixtureContext = new AsyncLocalStorage<CronJobFixtureContext>();

/**
 * Process-local integration seam used to invoke the real route module and
 * shared boundary without reaching production databases or paid upstreams.
 * It cannot be enabled in a production process and is never request-driven.
 */
export function runWithCronJobFixture<T>(
  fixture: CronJobFixtureContext,
  callback: () => T,
): T {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Cron integration fixtures are disabled in production");
  }
  return cronJobFixtureContext.run(fixture, callback);
}

function sha256(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part).update("\0");
  return hash.digest("hex");
}

function safeJsonResponse(
  payload: Record<string, unknown>,
  status: number,
  headers?: HeadersInit,
): NextResponse {
  const responseHeaders = new Headers(headers);
  if (!responseHeaders.has("Cache-Control")) {
    responseHeaders.set("Cache-Control", "no-store");
  }
  return NextResponse.json(payload, { status, headers: responseHeaders });
}

async function invokeHandler(
  jobId: string,
  handler: CronRouteHandler,
  request: Request,
): Promise<Response> {
  try {
    return await handler(request);
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[cron ${jobId}] unhandled failure`, error);
    return safeJsonResponse(
      { ok: false, jobId, outcome: "handler_exception" },
      500,
    );
  }
}

async function normalizeHandlerResponse(response: Response): Promise<{
  response: Response;
  succeeded: boolean;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> | null = null;
  if (contentType.includes("application/json")) {
    try {
      const value = (await response.clone().json()) as unknown;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        payload = value as Record<string, unknown>;
      }
    } catch {
      payload = null;
    }
  }

  if (response.ok && payload?.ok === false) {
    return {
      response: safeJsonResponse(payload, 500),
      succeeded: false,
    };
  }
  if (!response.ok && payload?.ok === true) {
    return {
      response: safeJsonResponse(
        { ok: false, outcome: "invalid_handler_response" },
        response.status,
      ),
      succeeded: false,
    };
  }
  return { response, succeeded: response.ok };
}

function requestMode(request: Request): "apply" | "dry_run" {
  return new URL(request.url).searchParams.get("dryRun") === "1"
    ? "dry_run"
    : "apply";
}

function canonicalRequestSha256(request: Request): string {
  const url = new URL(request.url);
  const queryParts = [...url.searchParams.entries()]
    // Key order is semantically irrelevant, but repeated values are not: the
    // handlers use URLSearchParams.get(), whose result is the first value.
    // Stable sort groups keys while preserving duplicate-value order.
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([key, value]) => [key, value]);
  return sha256([
    "civica-cron-request/v1",
    request.method.toUpperCase(),
    url.pathname,
    ...queryParts,
  ]);
}

/**
 * Read the stable logical-delivery identity that the authenticated cron
 * boundary injects before invoking a job handler. The boundary overwrites any
 * caller-supplied value, so downstream multi-stage writers can derive stable
 * run identities without trusting an external header.
 */
export function cronExecutionKeyFromRequest(request: Request): string {
  const executionKey = request.headers.get(INTERNAL_EXECUTION_KEY_HEADER) ?? "";
  if (!/^[a-f0-9]{64}$/.test(executionKey)) {
    throw new Error("Cron handler is missing its logical execution identity");
  }
  return executionKey;
}

function withInternalExecutionKey(
  request: Request,
  executionKey: string,
): Request {
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_EXECUTION_KEY_HEADER, executionKey);
  return new Request(request, { headers });
}

function readIdempotencyScope(request: Request):
  | {
      ok: true;
      triggerKind: "scheduled" | "manual";
      scopeKey: string | null;
    }
  | { ok: false; response: NextResponse } {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return {
      ok: false,
      response: safeJsonResponse(
        { ok: false, outcome: "method_not_allowed" },
        405,
        { Allow: "GET, POST" },
      ),
    };
  }

  const header = request.headers.get(IDEMPOTENCY_HEADER);
  const hasQuery = new URL(request.url).searchParams.size > 0;
  const requiresKey = method === "POST" || hasQuery;

  if (requiresKey && !header) {
    return {
      ok: false,
      response: safeJsonResponse(
        {
          ok: false,
          outcome: "idempotency_key_required",
        },
        400,
      ),
    };
  }
  if (header && !/^[A-Za-z0-9._:-]{1,120}$/.test(header)) {
    return {
      ok: false,
      response: safeJsonResponse(
        { ok: false, outcome: "invalid_idempotency_key" },
        400,
      ),
    };
  }

  return {
    ok: true,
    triggerKind: header ? "manual" : "scheduled",
    scopeKey: header ? sha256(["civica-cron-scope/v1", header]) : null,
  };
}

/**
 * Common cron boundary: authenticate before database access, claim one
 * schedule-slot lease, suppress completed duplicates, and persist the real
 * HTTP outcome before returning it. Failed/stale slots remain retryable.
 */
export function withCronJob(
  jobId: string,
  handler: CronRouteHandler,
  dependencies: CronJobDependencies = {},
): CronRouteHandler {
  const definition = getCronJobDefinition(jobId);

  return async function guardedCronHandler(
    request: Request,
  ): Promise<Response> {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) return unauthorized;

    const pathname = new URL(request.url).pathname;
    if (pathname !== definition.route) {
      console.error(
        `[cron ${jobId}] route registry mismatch: expected ${definition.route}, received ${pathname}`,
      );
      return safeJsonResponse(
        { ok: false, jobId, outcome: "route_registry_mismatch" },
        500,
      );
    }

    const input = validateCronInput(jobId, request);
    if (!input.ok) {
      return safeJsonResponse(
        {
          ok: false,
          jobId,
          outcome: "invalid_request",
          code: input.problem,
        },
        400,
        { "Cache-Control": "no-store" },
      );
    }

    const fixture = cronJobFixtureContext.getStore();
    const activeHandler: CronRouteHandler = fixture
      ? (fixtureRequest) => fixture.handler(jobId, fixtureRequest)
      : handler;

    // Retired v1 routes have no effect to lock, but still share the exact same
    // authentication and response-honesty boundary.
    if (definition.retired) {
      return (
        await normalizeHandlerResponse(
          await invokeHandler(jobId, activeHandler, request),
        )
      ).response;
    }

    const scope = readIdempotencyScope(request);
    if (!scope.ok) return scope.response;

    const now = dependencies.now?.() ?? new Date();
    const scheduleSlot =
      scope.triggerKind === "scheduled"
        ? latestCronScheduleSlot(definition.schedule!, now)
        : null;
    const mode = requestMode(request);
    const requestSha256 = canonicalRequestSha256(request);
    const executionKey =
      scope.triggerKind === "scheduled"
        ? sha256([
            "civica-cron-execution/v1",
            "scheduled",
            definition.id,
            definition.route,
            scheduleSlot!.toISOString(),
          ])
        : sha256([
            "civica-cron-execution/v1",
            "manual",
            definition.id,
            definition.route,
            scope.scopeKey!,
          ]);
    const store =
      dependencies.store ?? fixture?.store ?? postgresCronExecutionStore;

    let claim;
    try {
      claim = await store.acquire({
        executionKey,
        jobId: definition.id,
        route: definition.route,
        triggerKind: scope.triggerKind,
        scheduleSlot,
        requestMode: mode,
        scopeKey: scope.scopeKey,
        requestSha256,
        leaseMs: CRON_JOB_LEASE_MS,
        maxAttempts: MAX_CRON_ATTEMPTS,
      });
    } catch (error) {
      console.error(`[cron ${jobId}] delivery control unavailable`, error);
      return safeJsonResponse(
        { ok: false, jobId, outcome: "delivery_control_unavailable" },
        503,
      );
    }

    if (claim.state === "running" || claim.state === "busy") {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((claim.leaseExpiresAt.getTime() - now.getTime()) / 1_000),
      );
      if (claim.state === "busy") {
        return safeJsonResponse(
          {
            ok: false,
            jobId,
            outcome: "job_busy",
            jobStarted: false,
            deliveryRecorded: false,
          },
          503,
          { "Retry-After": String(retryAfterSeconds) },
        );
      }
      return safeJsonResponse(
        {
          ok: true,
          jobId,
          outcome: "job_in_progress",
          jobCompleted: false,
          attemptCount: claim.attemptCount,
        },
        202,
        { "Retry-After": String(retryAfterSeconds) },
      );
    }

    if (claim.state === "succeeded") {
      return safeJsonResponse(
        {
          ok: true,
          jobId,
          outcome: "duplicate_suppressed",
          jobCompleted: true,
          completedAt: claim.completedAt.toISOString(),
          originalStatus: claim.responseStatus,
          attemptCount: claim.attemptCount,
        },
        200,
      );
    }

    if (claim.state === "conflict") {
      return safeJsonResponse(
        {
          ok: false,
          jobId,
          outcome: "idempotency_key_conflict",
          attemptCount: claim.attemptCount,
        },
        409,
      );
    }

    if (claim.state === "exhausted") {
      return safeJsonResponse(
        {
          ok: false,
          jobId,
          outcome: "retry_limit_exhausted",
          attemptCount: claim.attemptCount,
        },
        503,
      );
    }

    const normalized = await normalizeHandlerResponse(
      await invokeHandler(
        jobId,
        activeHandler,
        withInternalExecutionKey(request, executionKey),
      ),
    );
    const terminalStatus = normalized.succeeded ? "succeeded" : "failed";

    try {
      const finished = await store.finish({
        executionKey,
        jobId: definition.id,
        leaseToken: claim.leaseToken,
        attemptId: claim.attemptId,
        leaseFence: claim.leaseFence,
        status: terminalStatus,
        responseStatus: normalized.response.status,
        resultCode: normalized.succeeded
          ? "handler_succeeded"
          : "handler_failed",
      });
      if (!finished) {
        throw new Error("Cron execution lost its lease before finalization");
      }
    } catch (error) {
      console.error(`[cron ${jobId}] delivery finalization failed`, error);
      return safeJsonResponse(
        { ok: false, jobId, outcome: "delivery_finalization_failed" },
        503,
      );
    }

    return normalized.response;
  };
}
