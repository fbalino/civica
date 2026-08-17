import assert from "node:assert/strict";
import { test } from "node:test";

import {
  estimatedRequestPopulation,
  jobPerformanceObservation,
  requestPerformanceObservation,
  routePerformanceAlerts,
  routePerformanceObservationErrors,
  serverErrorObservation,
  shouldRecordRequestPerformanceSample,
  type RoutePerformanceStore,
  type RoutePerformanceSummary,
  recordRoutePerformanceObservation,
  ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE,
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

function summaryPair(errorCount: number): RoutePerformanceSummary[] {
  return [
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
      sampleCount: errorCount,
      p95Ms: null,
      averageMs: null,
    },
  ];
}

test("alert thresholds require a meaningful sample and preserve route identity", () => {
  // 100 stored request rows represent 2,000 requests at the current rate, so
  // the 2% error threshold is crossed above 40 errors.
  const alerts = routePerformanceAlerts(summaryPair(60));
  assert.deepEqual(
    alerts.map((alert) => alert.id),
    ["request_p95", "server_error_rate"],
  );
  assert.ok(
    alerts.every((alert) => alert.routeId === "api.v1.countries.code.get"),
  );
  assert.ok(alerts.every((alert) => alert.releaseId === "abc1234"));
});

test("the server-error rate is measured against the estimated request population", () => {
  // Errors are never sampled while requests are, so comparing the two raw
  // counts would inflate the rate by 1/rate and fire on 3 errors in 2,000
  // requests (0.15%). The correction has to keep that below the threshold.
  const rawRatioWouldFire = 3 / 100 > 0.02;
  assert.equal(rawRatioWouldFire, true);
  assert.deepEqual(
    routePerformanceAlerts(summaryPair(3)).map((alert) => alert.id),
    ["request_p95"],
  );

  const [alert] = routePerformanceAlerts(summaryPair(60)).filter(
    (candidate) => candidate.id === "server_error_rate",
  );
  assert.ok(alert);
  assert.match(alert.detail, /60\/2000 server errors/);
});

test("the estimated request population scales a sampled count and fails closed", () => {
  assert.equal(ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE, 0.05);
  assert.equal(estimatedRequestPopulation(100), 2_000);
  assert.equal(estimatedRequestPopulation(1), 20);
  assert.equal(estimatedRequestPopulation(0), 0);
  assert.equal(estimatedRequestPopulation(-5), 0);
  assert.equal(estimatedRequestPopulation(Number.NaN), 0);
});

test("request sampling is uniform, injectable, and fails closed on a bad draw", () => {
  assert.equal(shouldRecordRequestPerformanceSample(() => 0), true);
  assert.equal(shouldRecordRequestPerformanceSample(() => 0.049), true);
  assert.equal(
    shouldRecordRequestPerformanceSample(
      () => ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE,
    ),
    false,
  );
  assert.equal(shouldRecordRequestPerformanceSample(() => 0.5), false);
  assert.equal(shouldRecordRequestPerformanceSample(() => 0.999), false);

  // An unusable random source must never become a write.
  for (const draw of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1, 1.5]) {
    assert.equal(shouldRecordRequestPerformanceSample(() => draw), false);
  }
});

test("sampling keeps every duration eligible so the stored p95 stays a percentile", () => {
  // A deterministic sweep across the unit interval must select a share equal
  // to the rate, independently of how long any individual request took.
  const draws = Array.from({ length: 1_000 }, (_, index) => index / 1_000);
  let selected = 0;
  for (const draw of draws) {
    if (shouldRecordRequestPerformanceSample(() => draw)) selected += 1;
  }
  assert.equal(selected, draws.length * ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE);
});
