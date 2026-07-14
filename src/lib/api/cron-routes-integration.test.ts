import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import type {
  CronExecutionClaim,
  CronExecutionClaimInput,
  CronExecutionFinishInput,
  CronExecutionStore,
} from "./cron-execution-store";
import { CRON_JOB_DEFINITIONS } from "./cron-job-registry";
import { runWithCronJobFixture } from "./cron-job";

type RouteModule = {
  GET?: (request: Request) => Promise<Response>;
  POST?: (request: Request) => Promise<Response>;
};

const ORIGINAL_SECRET = process.env.CRON_SECRET;
const TEST_SECRET = "cron-route-integration-secret";

function request(
  route: string,
  method: string,
  authorization?: string,
  idempotencyKey?: string,
): Request {
  const headers = new Headers();
  if (authorization) headers.set("authorization", authorization);
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  return new Request(`https://civicaatlas.org${route}`, {
    method,
    headers,
  });
}

interface FixtureExecution {
  requestSha256: string;
  status: "running" | "succeeded" | "failed";
  attemptCount: number;
  completedAt: Date | null;
  responseStatus: number | null;
  leaseToken: string | null;
  attemptId: string | null;
  leaseFence: number;
}

class FixtureCronStore implements CronExecutionStore {
  private readonly executions = new Map<string, FixtureExecution>();

  async acquire(input: CronExecutionClaimInput): Promise<CronExecutionClaim> {
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
    if (existing?.status === "running") {
      return {
        state: "running",
        leaseExpiresAt: new Date(Date.now() + input.leaseMs),
        attemptCount: existing.attemptCount,
      };
    }
    if (existing && existing.attemptCount >= input.maxAttempts) {
      return { state: "exhausted", attemptCount: existing.attemptCount };
    }

    const leaseToken = randomUUID();
    const attemptId = randomUUID();
    const leaseFence = (existing?.leaseFence ?? 0) + 1;
    const attemptCount = (existing?.attemptCount ?? 0) + 1;
    this.executions.set(input.executionKey, {
      requestSha256: input.requestSha256,
      status: "running",
      attemptCount,
      completedAt: null,
      responseStatus: null,
      leaseToken,
      attemptId,
      leaseFence,
    });
    return {
      state: "acquired",
      leaseToken,
      attemptId,
      leaseFence,
      leaseExpiresAt: new Date(Date.now() + input.leaseMs),
      attemptCount,
    };
  }

  async finish(input: CronExecutionFinishInput): Promise<boolean> {
    const existing = this.executions.get(input.executionKey);
    if (
      !existing ||
      existing.status !== "running" ||
      existing.leaseToken !== input.leaseToken ||
      existing.attemptId !== input.attemptId ||
      existing.leaseFence !== input.leaseFence
    ) {
      return false;
    }
    this.executions.set(input.executionKey, {
      ...existing,
      status: input.status,
      completedAt: new Date(),
      responseStatus: input.responseStatus,
      leaseToken: null,
      attemptId: null,
    });
    return true;
  }
}

async function loadRouteModule(routePath: string): Promise<RouteModule> {
  return (await import(
    pathToFileURL(routeFilePath(routePath)).href
  )) as RouteModule;
}

function routeFilePath(routePath: string): string {
  return path.join(process.cwd(), "src/app", routePath.slice(1), "route.ts");
}

test("every cron route exports the shared auth boundary and every scheduled route binds its registered path", async () => {
  try {
    for (const definition of CRON_JOB_DEFINITIONS) {
      const route = await loadRouteModule(definition.route);
      assert.equal(typeof route.GET, "function", `${definition.id} GET export`);
      assert.equal(
        typeof route.POST,
        "function",
        `${definition.id} POST export`,
      );
      assert.equal(
        route.GET,
        route.POST,
        `${definition.id} GET and POST must share one wrapper`,
      );

      delete process.env.CRON_SECRET;
      assert.equal(
        (await route.GET!(request(definition.route, "GET"))).status,
        401,
        `${definition.id} missing-secret GET`,
      );

      process.env.CRON_SECRET = TEST_SECRET;
      assert.equal(
        (
          await route.POST!(
            request(definition.route, "POST", "Bearer wrong-secret"),
          )
        ).status,
        401,
        `${definition.id} wrong-secret POST`,
      );

      if (!definition.retired) {
        assert.equal(
          (
            await route.GET!(
              request(definition.route, "PUT", `Bearer ${TEST_SECRET}`),
            )
          ).status,
          405,
          `${definition.id} must bind the registered path before database access`,
        );
      }
    }
  } finally {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

test("every scheduled route binding executes authenticated GET and POST deliveries", async () => {
  process.env.CRON_SECRET = TEST_SECRET;
  try {
    for (const definition of CRON_JOB_DEFINITIONS.filter(
      ({ retired }) => !retired,
    )) {
      const route = await loadRouteModule(definition.route);
      const store = new FixtureCronStore();
      let calls = 0;
      const fixture = {
        store,
        handler: (jobId: string) => {
          assert.equal(jobId, definition.id);
          calls++;
          return Response.json({ ok: true, jobId: definition.id });
        },
      };

      const getResponse = await runWithCronJobFixture(fixture, () =>
        route.GET!(request(definition.route, "GET", `Bearer ${TEST_SECRET}`)),
      );
      assert.equal(getResponse.status, 200, `${definition.id} GET success`);
      const postResponse = await runWithCronJobFixture(fixture, () =>
        route.POST!(
          request(
            definition.route,
            "POST",
            `Bearer ${TEST_SECRET}`,
            `${definition.id}-post`,
          ),
        ),
      );
      assert.equal(postResponse.status, 200, `${definition.id} POST success`);
      assert.equal(calls, 2, `${definition.id} authenticated handler calls`);
    }
  } finally {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

test("active cron routes delegate unknown exceptions to the safe shared boundary", async () => {
  for (const definition of CRON_JOB_DEFINITIONS.filter(
    ({ retired }) => !retired,
  )) {
    const source = await readFile(routeFilePath(definition.route), "utf8");
    assert.doesNotMatch(
      source,
      /\bcatch\s*\(/,
      `${definition.id} must not intercept unknown handler exceptions`,
    );
    assert.doesNotMatch(
      source,
      /\berrors\s*:\s*summary\.(?:errors|skipped)\b/,
      `${definition.id} must not serialize raw operational error details`,
    );
  }
});

test("secret-bearing thrown errors never reach any active cron response", async () => {
  process.env.CRON_SECRET = TEST_SECRET;
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    for (const definition of CRON_JOB_DEFINITIONS.filter(
      ({ retired }) => !retired,
    )) {
      const route = await loadRouteModule(definition.route);
      const store = new FixtureCronStore();
      const secretFragments = [
        "postgres://cron-user:database-password@private-db/civica",
        "provider-api-key-secret",
        `upstream detail for ${definition.id}`,
      ];
      const fixture = {
        store,
        handler: () => {
          throw new Error(secretFragments.join(" | "));
        },
      };

      const response = await runWithCronJobFixture(fixture, () =>
        route.GET!(request(definition.route, "GET", `Bearer ${TEST_SECRET}`)),
      );
      const body = await response.text();

      assert.equal(response.status, 500, `${definition.id} safe status`);
      assert.deepEqual(JSON.parse(body), {
        ok: false,
        jobId: definition.id,
        outcome: "handler_exception",
      });
      for (const fragment of secretFragments) {
        assert.equal(
          body.includes(fragment),
          false,
          `${definition.id} leaked ${fragment}`,
        );
      }
    }
  } finally {
    console.error = originalConsoleError;
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

test("every scheduled route binding records partial failure, retries, and suppresses the completed duplicate", async () => {
  process.env.CRON_SECRET = TEST_SECRET;
  try {
    for (const definition of CRON_JOB_DEFINITIONS.filter(
      ({ retired }) => !retired,
    )) {
      const route = await loadRouteModule(definition.route);
      const store = new FixtureCronStore();
      let calls = 0;
      const fixture = {
        store,
        handler: (jobId: string) => {
          assert.equal(jobId, definition.id);
          calls++;
          return calls === 1
            ? Response.json(
                { ok: false, outcome: "fixture_partial" },
                { status: 502 },
              )
            : Response.json({ ok: true, outcome: "fixture_completed" });
        },
      };
      const makeRequest = () =>
        request(
          definition.route,
          "POST",
          `Bearer ${TEST_SECRET}`,
          `${definition.id}-retry`,
        );

      const partial = await runWithCronJobFixture(fixture, () =>
        route.POST!(makeRequest()),
      );
      assert.equal(partial.status, 502, `${definition.id} partial status`);
      assert.equal(
        (await partial.json()).ok,
        false,
        `${definition.id} partial honesty`,
      );

      const retried = await runWithCronJobFixture(fixture, () =>
        route.POST!(makeRequest()),
      );
      assert.equal(retried.status, 200, `${definition.id} retry success`);
      assert.equal(calls, 2, `${definition.id} retry invokes handler`);

      const duplicate = await runWithCronJobFixture(fixture, () =>
        route.POST!(makeRequest()),
      );
      assert.equal(duplicate.status, 200, `${definition.id} duplicate status`);
      assert.equal(
        (await duplicate.json()).outcome,
        "duplicate_suppressed",
        `${definition.id} duplicate suppression`,
      );
      assert.equal(calls, 2, `${definition.id} duplicate skips handler`);
    }
  } finally {
    if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});
