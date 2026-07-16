import assert from "node:assert/strict";
import { test } from "node:test";

import {
  jobPerformanceObservation,
  requestPerformanceObservation,
  routePerformanceAlerts,
  routePerformanceObservationErrors,
  serverErrorObservation,
  type RoutePerformanceStore,
  recordRoutePerformanceObservation,
} from "./route-performance-telemetry";

test("route telemetry discards dynamic values and query strings", () => {
  const observation = requestPerformanceObservation(
    "/api/v1/countries/ury?email=private@example.com",
    "GET",
    41.2,
  );
  assert.equal(observation.routeId, "api.v1.countries.code.get");
  assert.equal(observation.method, "GET");
  assert.equal(observation.cacheProfile, "public-live");
  assert.equal(JSON.stringify(observation).includes("ury"), false);
  assert.equal(
    JSON.stringify(observation).includes("private@example.com"),
    false,
  );
  assert.deepEqual(routePerformanceObservationErrors(observation), []);
});

test("document, job, and server-error observations use closed shapes", () => {
  const document = requestPerformanceObservation("/country/japan", "GET", 12);
  assert.equal(document.routeId, "document.country");
  assert.equal(document.method, "DOCUMENT");
  assert.equal(document.cacheProfile, "document");

  const job = jobPerformanceObservation("pulse.v2.ingest", "POST", 45, 200);
  assert.equal(job.routeId, "job.pulse.v2.ingest");
  assert.equal(job.metric, "job_duration_ms");

  const error = serverErrorObservation(
    "/api/v1/index/ury?source=private",
    "GET",
  );
  assert.equal(error.routeId, "api.v1.index.country-slug.get");
  assert.equal(error.metric, "server_error");
  assert.equal(error.durationMs, null);
  assert.deepEqual(routePerformanceObservationErrors(error), []);
});

test("telemetry-store failures are swallowed", async () => {
  const failingStore: RoutePerformanceStore = {
    async insert() {
      throw new Error("database unavailable");
    },
    async pruneBefore() {
      throw new Error("database unavailable");
    },
  };
  const observation = requestPerformanceObservation("/atlas", "GET", 8);
  const originalError = console.error;
  console.error = () => undefined;
  try {
    assert.equal(
      await recordRoutePerformanceObservation(observation, failingStore),
      false,
    );
  } finally {
    console.error = originalError;
  }
});

test("alert thresholds require a meaningful sample and preserve route identity", () => {
  const alerts = routePerformanceAlerts([
    {
      routeId: "api.v1.countries.code.get",
      method: "GET",
      surface: "request",
      metric: "request_duration_ms",
      cacheProfile: "public-live",
      releaseId: "abc1234",
      sampleCount: 100,
      p95Ms: 1_600,
      averageMs: 500,
    },
    {
      routeId: "api.v1.countries.code.get",
      method: "GET",
      surface: "error",
      metric: "server_error",
      cacheProfile: "public-live",
      releaseId: "abc1234",
      sampleCount: 3,
      p95Ms: null,
      averageMs: null,
    },
  ]);
  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ["request_p95", "server_error_rate"],
  );
  assert.ok(
    alerts.every((alert) => alert.routeId === "api.v1.countries.code.get"),
  );
  assert.ok(alerts.every((alert) => alert.releaseId === "abc1234"));
});
