import {
  estimatedRequestPopulation,
  loadRoutePerformanceSummaries,
  routePerformanceAlerts,
  ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE,
  ROUTE_PERFORMANCE_TELEMETRY_VERSION,
  ROUTE_PERFORMANCE_WINDOW_HOURS,
} from "@/lib/platform/route-performance-telemetry";

async function main() {
  const summaries = await loadRoutePerformanceSummaries();
  const payload = {
    contract: ROUTE_PERFORMANCE_TELEMETRY_VERSION,
    windowHours: ROUTE_PERFORMANCE_WINDOW_HOURS,
    generatedAt: new Date().toISOString(),
    requestSampleRate: ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE,
    sampling:
      "request_duration_ms rows are a uniform random sample of matched " +
      "requests; job_duration_ms and server_error rows are unsampled. " +
      "sampleCount is a stored-observation count, never a throughput " +
      "measurement. Use estimatedRequestCount for request volume; latency " +
      "percentiles and averages need no correction.",
    summaries: summaries.map((summary) => ({
      ...summary,
      estimatedRequestCount:
        summary.metric === "request_duration_ms"
          ? estimatedRequestPopulation(summary.sampleCount)
          : summary.sampleCount,
    })),
    alerts: routePerformanceAlerts(summaries),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  console.error("Route-performance report failed without writing telemetry.");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
