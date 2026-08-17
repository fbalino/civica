import { existsSync, readFileSync } from "node:fs";

const files = {
  schema: "src/lib/db/schema.ts",
  telemetry: "src/lib/platform/route-performance-telemetry.ts",
  proxy: "src/proxy.ts",
  instrumentation: "instrumentation.ts",
  cron: "src/lib/api/cron-job.ts",
  dictionary: "src/lib/data-dictionary/registry.ts",
  policy: "data/ROUTE-PERFORMANCE-TELEMETRY.md",
  report: "scripts/report-route-performance.ts",
  migration: "drizzle/authoritative/0037_minor_sharon_carter.sql",
  plan: "plan/PLT-016-route-performance-telemetry-2026-07-15.md",
} as const;

const errors: string[] = [];
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path))
    errors.push(`missing ${name} contract source: ${path}`);
}

if (errors.length === 0) {
  const schema = readFileSync(files.schema, "utf8");
  const telemetry = readFileSync(files.telemetry, "utf8");
  const proxy = readFileSync(files.proxy, "utf8");
  const instrumentation = readFileSync(files.instrumentation, "utf8");
  const cron = readFileSync(files.cron, "utf8");
  const dictionary = readFileSync(files.dictionary, "utf8");
  const policy = readFileSync(files.policy, "utf8");
  const migration = readFileSync(files.migration, "utf8");

  for (const token of [
    "routePerformanceObservations",
    "route_performance_observations",
    "idx_route_performance_observed_at",
    "idx_route_performance_route_metric_time",
    "idx_route_performance_release_time",
    "route_performance_observation_route_shape",
    "route_performance_observation_surface_metric_closed",
  ]) {
    if (!schema.includes(token)) errors.push(`schema omits ${token}`);
  }
  for (const token of [
    "classifyRoutePerformanceRequest",
    'pathname.split("?")[0]',
    "ROUTE_FRESHNESS_POLICY",
    "routePerformanceAlerts",
    "ROUTE_PERFORMANCE_RETENTION_DAYS = 30",
    "telemetry_write_failed",
    "ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE",
    "export function shouldRecordRequestPerformanceSample(",
    "export function estimatedRequestPopulation(",
  ]) {
    if (!telemetry.includes(token))
      errors.push(`telemetry contract omits ${token}`);
  }
  if (!proxy.includes('process.env.NODE_ENV !== "production"'))
    errors.push("proxy must not write telemetry outside production");
  if (!proxy.includes("after(async () =>"))
    errors.push("proxy must defer request telemetry until after the response");
  if (proxy.includes("request.nextUrl.search"))
    errors.push("proxy must not pass query data into telemetry");

  // The sampling decision is a named, injectable seam. Inlining a raw draw in
  // the proxy would make the rate untestable and undocumentable.
  if (!proxy.includes("shouldRecordRequestPerformanceSample()"))
    errors.push("proxy must gate request telemetry on the named sampler");
  if (/Math\s*\.\s*random/.test(proxy))
    errors.push("proxy must not inline a sampling draw");

  // The proxy must not run on the build asset tree or on static image/font
  // requests, which carry no route-performance signal.
  // Anchored on the end of the config object: the matcher itself contains
  // `]` characters inside its character classes.
  const matcherMatch = proxy.match(/matcher:\s*\[([\s\S]*?)\]\s*,?\s*\}\s*;/);
  if (!matcherMatch) {
    errors.push("proxy must declare a static matcher array");
  } else {
    const matcher = matcherMatch[1]!;
    if (!matcher.includes("_next/"))
      errors.push("proxy matcher must exclude the whole _next/ tree");
    for (const extension of [
      "webp",
      "avif",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "ico",
      "woff2",
      "woff",
      "ttf",
      "otf",
      "eot",
    ])
      if (!new RegExp(`\\b${extension}\\b`).test(matcher))
        errors.push(`proxy matcher must exclude .${extension} assets`);
    if (!matcher.includes("$)"))
      errors.push(
        "proxy matcher must anchor the asset exclusion to a trailing extension",
      );
  }

  // Errors and jobs are unsampled, so any comparison against the sampled
  // request count has to be rate-corrected rather than raw.
  if (!telemetry.includes("estimatedRequestPopulation(requests.get(key)"))
    errors.push(
      "server-error rate must use the estimated request population, not the sampled count",
    );
  const report = readFileSync(files.report, "utf8");
  if (!report.includes("ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE"))
    errors.push("route-performance report omits the request sample rate");
  for (const token of [
    "onRequestError",
    "serverErrorObservation",
    "Promise.race",
  ])
    if (!instrumentation.includes(token))
      errors.push(`instrumentation omits ${token}`);
  for (const token of [
    "jobPerformanceObservation",
    "scheduleRoutePerformanceObservation",
    "scheduleRoutePerformancePrune",
  ])
    if (!cron.includes(token)) errors.push(`cron telemetry omits ${token}`);
  for (const token of [
    "route_performance_observations:",
    "privacy-bounded",
    "30 days",
  ])
    if (!dictionary.includes(token))
      errors.push(`data dictionary omits ${token}`);
  for (const [label, pattern] of [
    ["IP addresses", /IP addresses?/],
    ["user agents", /user agents?/],
    ["request bodies", /request bod(?:y|ies)/],
    ["error text", /error\s+(?:text|messages?)/],
  ] as const)
    if (!pattern.test(policy))
      errors.push(`privacy policy must explicitly exclude ${label}`);
  for (const [label, pattern] of [
    ["the matcher scope", /## Collection scope/],
    ["the request sample rate", /1 in 20|5%/],
    ["that jobs and errors are unsampled", /unsampled|not sampled/],
  ] as const)
    if (!pattern.test(policy)) errors.push(`policy must document ${label}`);
  for (const token of [
    'CREATE TABLE "route_performance_observations"',
    "duration_ms",
    "release_id",
  ])
    if (!migration.includes(token)) errors.push(`migration omits ${token}`);
}

if (errors.length > 0) {
  throw new Error(
    `Route-performance telemetry contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log(
  "civica-route-performance/v1: privacy, retention, route, release, and failure-isolation contracts pass static validation.",
);
