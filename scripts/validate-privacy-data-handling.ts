import { existsSync, readFileSync } from "node:fs";

import {
  PRIVACY_DATA_FLOWS,
  PRIVACY_DATA_HANDLING_VERSION,
  privacyDataHandlingErrors,
} from "../src/lib/privacy/data-handling";

const read = (path: string) => readFileSync(path, "utf8");
const errors = privacyDataHandlingErrors();

for (const flow of PRIVACY_DATA_FLOWS) {
  for (const path of flow.sourcePaths) {
    if (!existsSync(path)) errors.push(`${flow.id}: missing source path ${path}`);
  }
}

const privacyPage = read("src/app/privacy/page.tsx");
for (const fragment of [
  "PUBLIC_PRIVACY_DATA_FLOWS",
  "PRIVACY_DATA_FLOWS",
  "PRIVACY_DATA_HANDLING_VERSION",
  "no advertising or analytics trackers",
  "New messages do not retain your raw IP address",
  "Civica does not claim that",
  "zero-data retention is enabled",
  "FlagCDN",
  "OpenFreeMap",
  "Mapbox",
]) {
  if (!privacyPage.includes(fragment))
    errors.push(`privacy page: missing ${fragment}`);
}

const contactRoute = read("src/app/api/contact/route.ts");
if (contactRoute.includes("getRequestIp"))
  errors.push("contact route still reads a raw request IP");
if (!contactRoute.includes("ipAddress: null"))
  errors.push("contact route does not explicitly prevent raw-IP retention");

const adminMessageRoute = read("src/app/api/admin/messages/[id]/route.ts");
for (const fragment of [
  'body.intent === "delete"',
  'body.confirm !== "delete"',
  ".delete(contactSubmissions)",
]) {
  if (!adminMessageRoute.includes(fragment))
    errors.push(`admin message route: missing ${fragment}`);
}

const adminMessagePage = read(
  "src/app/(admin)/admin/messages/[id]/page.tsx",
);
if (adminMessagePage.includes("msg.ipAddress"))
  errors.push("admin message page still exposes a legacy raw IP");
if (!adminMessagePage.includes("Delete permanently"))
  errors.push("admin message page lacks permanent deletion control");

const routePerformance = read(
  "src/lib/platform/route-performance-telemetry.ts",
);
if (!routePerformance.includes("ROUTE_PERFORMANCE_RETENTION_DAYS = 30"))
  errors.push("route-performance retention drifted from 30 days");
const errorMonitoring = read("src/lib/platform/error-monitoring.ts");
if (!errorMonitoring.includes("ERROR_MONITORING_RETENTION_DAYS = 90"))
  errors.push("error-monitoring retention drifted from 90 days");

const purge = read("scripts/purge-legacy-private-identifiers.ts");
for (const fragment of [
  'const apply = args.has("--apply")',
  `--confirm=\${APPLY_CONFIRMATION}`,
  'mode: apply ? "apply" : "plan"',
  "SET ip_address = NULL",
]) {
  if (!purge.includes(fragment))
    errors.push(`legacy identifier purge: missing ${fragment}`);
}

const manual = read("plan/MANUAL-CHECKS.md");
if (!manual.includes("BRD-012"))
  errors.push("BRD-012 professional/production review is not queued");
const operations = read("data/PRIVACY-DATA-HANDLING.md");
for (const fragment of [
  PRIVACY_DATA_HANDLING_VERSION,
  "one legacy contact row",
  "no production mutation",
  "professional privacy review",
]) {
  if (!operations.includes(fragment))
    errors.push(`privacy operations policy: missing ${fragment}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `PASS ${PRIVACY_DATA_HANDLING_VERSION}: inventory, disclosures, minimization, deletion, retention, provider, and manual-review boundaries are closed.`,
);
