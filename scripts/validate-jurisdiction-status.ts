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

const surfaceContracts: Array<[string, string[]]> = [
  ["src/app/(reader)/country/page.tsx", ["getAllReferenceJurisdictions"]],
  // The header search reads the checked jurisdiction-directory artifact
  // (CAC-003/CAC-004), which is derived from and validated against the full
  // 253-entry reference catalog by validate:jurisdiction-directory.
  [
    "src/components/GlobalSearchWrapper.tsx",
    ["jurisdictions/directory.generated.json", "statusLabel"],
  ],
  ["src/components/home/HomeGrid.tsx", ["getAllReferenceJurisdictions"]],
  ["src/app/compare/page.tsx", ["getAllReferenceJurisdictions"]],
  ["src/app/sitemap.ts", ["getAllReferenceJurisdictions"]],
  [
    "src/app/(reader)/country/[slug]/layout.tsx",
    ["jurisdictionStatus", "buildJurisdiction"],
  ],
  [
    "src/components/factbook/FactbookHeaderStrip.tsx",
    ["JurisdictionStatusDisclosure"],
  ],
  [
    "src/app/api/v1/countries/route.ts",
    [
      "buildJurisdictionStatusPresentation",
      '"v1-countries-query/v1"',
      "status: statusParam",
    ],
  ],
  [
    "src/app/api/v1/countries/[code]/route.ts",
    ["buildJurisdictionStatusPresentation"],
  ],
  [
    "src/components/atlas/AtlasWorldMap.tsx",
    ["jurisdiction-status/v1", "full reference catalog", "statusLabel"],
  ],
  [
    "src/lib/exports/country-research-export.ts",
    ["jurisdiction_status_sources_json", "statusDetails"],
  ],
];

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
  errors.push("sovereign-state analytical query no longer fails closed");
}
if (!queries.includes("getAllReferenceJurisdictions")) {
  errors.push("full reference-catalog query is missing");
}
for (const [path, markers] of surfaceContracts) {
  const source = readFileSync(resolve(root, path), "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      errors.push(`${path} is missing status contract marker ${marker}`);
    }
  }
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
