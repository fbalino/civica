import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const errors: string[] = [];

for (const [path, fragments] of Object.entries({
  "next.config.ts": [
    "productionBrowserSourceMaps: protectedSourceMapsEnabled",
    "serverSourceMaps: true",
    "debugIds: true",
  ],
  "instrumentation.ts": [
    "context.routePath",
    "recordErrorMonitoringEvent",
    "next.${context.routeType}_error",
  ],
  "src/lib/platform/error-monitoring.ts": [
    "civica-error-monitoring/v1",
    "sourceMapIdForRelease",
    "errorMonitoringIssueLinks",
    "record_failed",
  ],
  "src/lib/db/schema.ts": [
    "errorMonitoringEvents",
    "errorMonitoringIssueLinks",
    "error_monitoring_context_check",
  ],
  "src/app/error.tsx": ["reportClientBoundaryError(\"route_boundary\")"],
  "src/app/global-error.tsx": ["reportClientBoundaryError(\"global_boundary\")"],
  "src/app/api/observability/client-error/route.ts": [
    "enforceRequestRateLimit",
    "clientErrorMonitoringBodySchema",
    "recordErrorMonitoringEvent",
  ],
  "src/lib/api/cron-job.ts": ["recordCronFailure", "pruneErrorMonitoringEvents"],
  "scripts/run-observed-production-pipeline.ts": [
    "script.child_exit_failure",
    "recordErrorMonitoringEvent",
  ],
  "src/app/api/cron/operations/error-alerts/route.ts": [
    "withCronJob(\"operations.error-alerts\"",
    "[error-monitoring-alert]",
  ],
  "data/ERROR-MONITORING.md": [
    "Protected Source Maps",
    "VERCEL_PROTECTED_SOURCEMAPS",
    "report:error-monitoring",
  ],
  "data/OPERATIONAL-RUNBOOKS.md": [
    "Exception / error-monitoring incident",
    "report:error-monitoring",
  ],
  ".env.example": ["VERCEL_PROTECTED_SOURCEMAPS"],
  "package.json": ["validate:error-monitoring", "report:error-monitoring"],
  "vercel.json": ["/api/cron/operations/error-alerts"],
})) {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) errors.push(`${path}: missing ${fragment}`);
  }
}

for (const path of ["src/app/error.tsx", "src/app/global-error.tsx"]) {
  const source = read(path);
  if (/console\.error\(/.test(source)) errors.push(`${path}: raw browser error logging remains`);
}

const schema = read("src/lib/db/schema.ts");
const monitoringSchema = schema.slice(
  schema.indexOf("export const errorMonitoringEvents"),
  schema.indexOf("// --- Durable (cross-instance) rate limiter ---"),
);
for (const forbidden of ["errorMessage", "stackTrace", "errorDigest", "requestBody", "headers"]) {
  if (monitoringSchema.includes(forbidden)) {
    errors.push(`error-monitoring schema retains forbidden ${forbidden}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("PASS error monitoring: source-map, scrub, alert, and resolution contracts are closed.");
