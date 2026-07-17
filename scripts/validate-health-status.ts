import { existsSync, readFileSync } from "node:fs";

const files = {
  health: "src/lib/platform/health-status.ts",
  route: "src/app/api/health/route.ts",
  monitor: "src/app/api/cron/operations/health-alerts/route.ts",
  registry: "src/lib/data/production-adapter-registry.ts",
  inventory: "src/lib/api/route-inventory/registry.ts",
  vercel: "vercel.json",
  docs: "data/HEALTH-STATUS.md",
  runbooks: "data/OPERATIONAL-RUNBOOKS.md",
  evidence: "plan/evidence/PLT-020/health-status-drill.json",
  plan: "plan/MASTER-CHECKLIST.md",
  packageJson: "package.json",
} as const;

const errors: string[] = [];
for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) errors.push(`missing ${name} contract source: ${path}`);
}

if (errors.length === 0) {
  const read = (path: string) => readFileSync(path, "utf8");
  const health = read(files.health);
  const route = read(files.route);
  const monitor = read(files.monitor);
  const registry = read(files.registry);
  const inventory = read(files.inventory);
  const vercel = read(files.vercel);
  const docs = read(files.docs);
  const runbooks = read(files.runbooks);
  const evidence = JSON.parse(read(files.evidence)) as Record<string, unknown>;
  const plan = read(files.plan);
  const packageJson = JSON.parse(read(files.packageJson)) as {
    scripts?: Record<string, string>;
  };

  for (const token of [
    "civica-health-status/v1",
    '"application"',
    '"database"',
    '"critical_assets"',
    '"scheduled_data_freshness"',
    '"model_dependent_optional_services"',
    "loadPipelineAlertRows",
    "pipelineAlerts",
    "statusPageDecision",
    "HEALTH_ASSET_PROBE_TIMEOUT_MS = 5_000",
  ]) {
    if (!health.includes(token)) errors.push(`health contract omits ${token}`);
  }
  for (const forbidden of [
    "error.message",
    "DATABASE_URL",
    "JSON.stringify(error)",
  ]) {
    if (route.includes(forbidden)) errors.push(`public health route exposes ${forbidden}`);
  }
  for (const token of [
    "withSafeJsonErrors",
    "checkHealthStatus",
    "healthHttpStatus",
    '"api/health"',
  ]) {
    if (!route.includes(token)) errors.push(`public health route omits ${token}`);
  }
  for (const token of [
    'withCronJob("operations.health-alerts"',
    "statusPageDecision",
    "[health-alert]",
    'step: "operations.health-alerts"',
  ]) {
    if (!monitor.includes(token)) errors.push(`health monitor omits ${token}`);
  }
  for (const token of [
    'id: "operations.health-alerts"',
    'route: "/api/cron/operations/health-alerts"',
  ]) {
    if (!registry.includes(token)) errors.push(`adapter registry omits ${token}`);
  }
  for (const token of [
    'filePath: "api/health/route.ts"',
    "content-free availability contract",
  ]) {
    if (!inventory.includes(token)) errors.push(`route inventory omits ${token}`);
  }
  if (!vercel.includes('"path": "/api/cron/operations/health-alerts"')) {
    errors.push("vercel schedule omits health monitor");
  }
  if (!vercel.includes('"schedule": "*/15 * * * *"')) {
    errors.push("health monitor must run every 15 minutes");
  }
  for (const token of [
    "https://statuspage.incident.io/civica-atlas",
    "two consecutive 15-minute",
    "/api/health",
    "Fernando Balino",
    "Incident.io",
  ]) {
    if (!docs.includes(token)) errors.push(`health runbook omits ${token}`);
  }
  if (!runbooks.includes("PLT-020 health/status contract")) {
    errors.push("operational runbooks do not adopt PLT-020 health/status contract");
  }
  for (const [key, expected] of Object.entries({
    task: "PLT-020",
    contract: "civica-health-status/v1",
    drill: "status-page-publication-decision",
  })) {
    if (evidence[key] !== expected) errors.push(`drill evidence ${key} drifted`);
  }
  if (!plan.includes("[x] **PLT-020**")) errors.push("master checklist does not close PLT-020");
  if (!packageJson.scripts?.["validate:health-status"]) {
    errors.push("package scripts omit validate:health-status");
  }
}

if (errors.length > 0) {
  throw new Error(
    `Health/status contract failed:\n${errors.map((error) => `- ${error}`).join("\n")}`,
  );
}

console.log(
  "civica-health-status/v1: public component probes, status-page thresholds, owner drill, and monitor scheduling pass static validation.",
);
