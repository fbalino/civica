import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getJurisdictionStatusCatalogSummary,
  JURISDICTION_STATUS_DISPLAY_POLICY,
  JURISDICTION_STATUS_TYPES,
} from "../src/lib/jurisdictions/status-taxonomy";

const root = process.cwd();
const schema = readFileSync(resolve(root, "src/lib/db/schema.ts"), "utf8");
const seeder = readFileSync(
  resolve(root, "scripts/seed-from-factbook.ts"),
  "utf8",
);
const queries = readFileSync(resolve(root, "src/lib/db/queries.ts"), "utf8");
const migration = readFileSync(
  resolve(root, "drizzle/migrations/0020_jurisdiction_status_taxonomy.sql"),
  "utf8",
);
const summary = getJurisdictionStatusCatalogSummary();
const errors: string[] = [];

if (summary.total !== 253) {
  errors.push(`closed catalog contains ${summary.total} entries, expected 253`);
}
if (summary.unMemberStates !== 193) {
  errors.push(
    `UN member inventory contains ${summary.unMemberStates}, expected 193`,
  );
}

for (const field of [
  "statusSourceIds",
  "statusReviewedAt",
  "statusNote",
  "administeringJurisdictionIso3",
  "statusDisputed",
]) {
  if (!schema.includes(`${field}:`)) errors.push(`schema missing ${field}`);
}

if (!seeder.includes("classifyJurisdictionStatus")) {
  errors.push("Factbook seeder does not call classifyJurisdictionStatus");
}
if (!queries.includes("type} = 'sovereign_state'")) {
  errors.push("public country queries no longer enforce sovereign_state scope");
}
if (
  !migration.includes("jurisdictions_status_type_check") ||
  !migration.includes("__unclassified__") ||
  !migration.includes("expected the frozen 253-row catalog")
) {
  errors.push(
    "forward migration is missing its vocabulary or fail-closed guards",
  );
}
if (JURISDICTION_STATUS_TYPES.length !== 5) {
  errors.push("canonical status vocabulary drifted from five declared classes");
}
if (
  Object.values(JURISDICTION_STATUS_DISPLAY_POLICY).filter(
    (policy) => policy.includeInSovereignStateCounts,
  ).length !== 1 ||
  !JURISDICTION_STATUS_DISPLAY_POLICY.sovereign_state
    .includeInSovereignStateCounts
) {
  errors.push(
    "display policy must count only sovereign_state in sovereign totals",
  );
}

console.log("=== DAT-004 jurisdiction-status validation ===\n");
console.log(`Closed catalog entries: ${summary.total}`);
console.log(`UN member states: ${summary.unMemberStates}`);
console.log(`Dependencies/territories: ${summary.dependenciesOrTerritories}`);
console.log(
  `Associated/limited/disputed/special/aggregate: ${
    summary.associatedStates +
    summary.limitedRecognitionIso3 +
    summary.disputedAreas +
    summary.specialAreas +
    summary.aggregateAreas
  }`,
);

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log("\nPASS — the status catalog is closed, sourced, and fail-closed.");
