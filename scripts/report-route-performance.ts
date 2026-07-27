import {
  loadRoutePerformanceSummaries,
  routePerformanceAlerts,
  ROUTE_PERFORMANCE_TELEMETRY_VERSION,
  ROUTE_PERFORMANCE_WINDOW_HOURS,
} from "@/lib/platform/route-performance-telemetry";

async function main() {
  const summaries = await loadRoutePerformanceSummaries();
  const payload = {
    contract: ROUTE_PERFORMANCE_TELEMETRY_VERSION,
    windowHours: ROUTE_PERFORMANCE_WINDOW_HOURS,
    generatedAt: new Date().toISOString(),
    summaries,
    alerts: routePerformanceAlerts(summaries),
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  console.error("Route-performance report failed without writing telemetry.");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});
