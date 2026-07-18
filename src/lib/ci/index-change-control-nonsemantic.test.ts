import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { indexProtectedFileHash, sha256 } from "./index-change-control";

const path = "src/lib/db/queries.ts";
const currentSource = readFileSync(path, "utf8");
const priorSource = currentSource
  .replace(
    /\.where\(\n      sql`\$\{legislatureParties\.bodyId\} IN \$\{bodyIds\}\n        AND \$\{legislatureParties\.isCurrent\} = true`,\n    \)/g,
    ".where(sql`${legislatureParties.bodyId} IN ${bodyIds}`)",
  )
  .replace(
    /      joinDatePrecision: organizationMemberships\.joinDatePrecision,\n      endDate: organizationMemberships\.endDate,\n      endDatePrecision: organizationMemberships\.endDatePrecision,\n/g,
    "",
  )
  .replace(
    /      status: organizationMemberships\.status,\n      disputed: organizationMemberships\.disputed,\n      sourceId: organizationMemberships\.sourceId,\n      sourceUrl: organizationMemberships\.sourceUrl,\n      sourceLicense: organizationMemberships\.sourceLicense,\n      sourceRetrievedAt: organizationMemberships\.sourceRetrievedAt,\n      upstreamVintage: organizationMemberships\.upstreamVintage,\n/g,
    "",
  )
  .replace(
    /\.where\(\n      sql`\$\{organizationMemberships\.jurisdictionId\} IN \$\{jurisdictionIds\}\n      AND \$\{organizationMemberships\.status\} <> 'unverified_legacy'`,\n    \)/g,
    ".where(sql`${organizationMemberships.jurisdictionId} IN ${jurisdictionIds}`)",
  )
  .replace(
    `    .select({
      factKey: countryFacts.factKey,
      category: countryFacts.category,
      sourceId: countryFacts.sourceId,
      sourceUrl: countryFacts.sourceUrl,
      factValue: countryFacts.factValue,
      factValueNumeric: countryFacts.factValueNumeric,
      factUnit: countryFacts.factUnit,
      factYear: countryFacts.factYear,
      valueJson: countryFacts.valueJson,
      valueStatus: countryFacts.valueStatus,
      valueStatusReason: countryFacts.valueStatusReason,
      asOf: countryFacts.asOf,
      retrievedAt: countryFacts.retrievedAt,
      upstreamVintageLabel: countryFacts.upstreamVintageLabel,
      valueType: countryFacts.valueType,
    })
    .from(countryFacts)
    .where(
      sql\`\${countryFacts.jurisdictionId} = \${jurisdictionId}
        AND \${countryFacts.factKey} LIKE 'freedom_house%'
        AND \${countryFacts.status} = 'active'\`,
    );`,
    `    .select()
    .from(countryFacts)
    .where(
      sql\`\${countryFacts.jurisdictionId} = \${jurisdictionId} AND \${countryFacts.factKey} LIKE 'freedom_house%'\`,
    );`,
    );

function withoutNonsemanticManifestAdditions(source: string): string {
  return source
    .replace(
      /  spec\(\n    "civica_organization_roster_v1",[\s\S]*?    "restricted-no-redistribution",\n  \),\n/,
      "",
    )
    .replace(
      '  "operations.health-alerts":\n' +
        '    "content-free application, database, active-map-asset, scheduled-freshness, and optional-model availability states",\n',
      "",
    )
    .replace(
      '  "operations.error-alerts":\n' +
        '    "open content-free error-monitoring records retained for the active alert window",\n',
      "",
    )
    .replace(
      '  "operations.pipeline-alerts":\n' +
        '    "retained production pipeline-run rows and the registered cron schedule contract",\n',
      "",
    );
}

function withoutNonsemanticAdapterAdditions(source: string): string {
  return source
    .replace(
      /    \{\n      id: "atlas\.organization-memberships",[\s\S]*?    \},\n/,
      "",
    )
    .replace(
      `    {
      id: "operations.health-alerts",
      route: "/api/cron/operations/health-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/health-alerts/route.ts",
        "src/lib/platform/health-status.ts",
      ],
    },
`,
      "",
    )
    .replace(
      `    {
      id: "operations.error-alerts",
      route: "/api/cron/operations/error-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/error-alerts/route.ts",
        "src/lib/platform/error-monitoring.ts",
      ],
    },
`,
      "",
    )
    .replace(
      `    {
      id: "operations.pipeline-alerts",
      route: "/api/cron/operations/pipeline-alerts",
      inputKind: "derived",
      sources: [],
      implementationPaths: [
        "src/app/api/cron/operations/pipeline-alerts/route.ts",
        "src/lib/platform/pipeline-observability.ts",
      ],
    },
`,
      "",
    )
    .replace(/  canonicalNpmScript: string;\n/g, "")
    .replace(/      canonicalNpmScript: "[^"]+",\n/g, "");
}

test("current-party read guards are excluded from Index semantic drift", () => {
  assert.notEqual(currentSource, priorSource);
  assert.equal(
    indexProtectedFileHash(path, currentSource),
    sha256(priorSource),
  );
});

test("organization provenance fields and the legacy-row guard are excluded from Index semantic drift", () => {
  assert.equal(
    indexProtectedFileHash(path, currentSource),
    sha256(priorSource),
  );

  const changedStatus = currentSource.replace(
    "organizationMemberships.status} <> 'unverified_legacy'",
    "organizationMemberships.status} = 'current'",
  );
  assert.notEqual(
    indexProtectedFileHash(path, changedStatus),
    indexProtectedFileHash(path, currentSource),
  );
});

test("the Atlas-only democracy response projection is excluded from Index semantic drift", () => {
  assert.notEqual(currentSource, priorSource);
  assert.equal(
    indexProtectedFileHash(path, currentSource),
    sha256(priorSource),
  );

  const changedProjection = currentSource.replace(
    "valueType: countryFacts.valueType,",
    "valueType: countryFacts.valueType,\n      id: countryFacts.id,",
  );
  assert.notEqual(
    indexProtectedFileHash(path, changedProjection),
    indexProtectedFileHash(path, currentSource),
  );
});

test("other shared-query edits remain protected Index drift", () => {
  const unrelatedEdit = `${currentSource}\n// unrelated semantic edit\n`;
  assert.notEqual(
    indexProtectedFileHash(path, unrelatedEdit),
    indexProtectedFileHash(path, currentSource),
  );
});

test("the Atlas-only organization source specification is excluded from Index semantic drift", () => {
  const manifestPath = "src/lib/data/source-input-manifest.ts";
  const currentManifest = readFileSync(manifestPath, "utf8");
  const priorManifest = withoutNonsemanticManifestAdditions(currentManifest);
  assert.notEqual(currentManifest, priorManifest);
  assert.equal(
    indexProtectedFileHash(manifestPath, currentManifest),
    sha256(priorManifest),
  );
});

test("the platform-only health monitor derived input is excluded from Index semantic drift", () => {
  const manifestPath = "src/lib/data/source-input-manifest.ts";
  const currentManifest = readFileSync(manifestPath, "utf8");
  const priorManifest = withoutNonsemanticManifestAdditions(currentManifest);
  assert.notEqual(currentManifest, priorManifest);
  assert.equal(
    indexProtectedFileHash(manifestPath, currentManifest),
    sha256(priorManifest),
  );
});

test("the Atlas-only organization adapter is excluded from Index semantic drift", () => {
  const registryPath = "src/lib/data/production-adapter-registry.ts";
  const currentRegistry = readFileSync(registryPath, "utf8");
  const priorRegistry = withoutNonsemanticAdapterAdditions(currentRegistry);
  assert.notEqual(currentRegistry, priorRegistry);
  assert.equal(
    indexProtectedFileHash(registryPath, currentRegistry),
    sha256(priorRegistry),
  );
});

test("the platform-only health monitor adapter is excluded from Index semantic drift", () => {
  const registryPath = "src/lib/data/production-adapter-registry.ts";
  const currentRegistry = readFileSync(registryPath, "utf8");
  const priorRegistry = withoutNonsemanticAdapterAdditions(currentRegistry);
  assert.notEqual(currentRegistry, priorRegistry);
  assert.equal(
    indexProtectedFileHash(registryPath, currentRegistry),
    sha256(priorRegistry),
  );
});

test("the serverless Index-ingest client is excluded from method drift", () => {
  const ingestPath = "src/lib/ci/ingest.ts";
  const currentIngest = readFileSync(ingestPath, "utf8");
  const priorIngest = currentIngest
    .replace('import { createServerlessSql } from "../db";\n', "")
    .replace(
      'import { writeFileSync } from "node:fs";\n',
      'import { neon } from "@neondatabase/serverless";\nimport { writeFileSync } from "node:fs";\n',
    )
    .replace(
      "const sqlClient = createServerlessSql(process.env.DATABASE_URL!);",
      "const sqlClient = neon(process.env.DATABASE_URL!);",
    );
  assert.notEqual(currentIngest, priorIngest);
  assert.equal(
    indexProtectedFileHash(ingestPath, currentIngest),
    sha256(priorIngest),
  );
});

test("the Atlas-only Bills coverage state is excluded from Index semantic drift", () => {
  const pagePath = "src/app/(reader)/country/[slug]/civica-data/page.tsx";
  const currentPage = readFileSync(pagePath, "utf8");
  const priorPage = currentPage.replace(
    '  const hasBills = billsResult.status === "available";\n',
    "  const hasBills = false;\n",
  );
  assert.notEqual(currentPage, priorPage);
  assert.equal(
    indexProtectedFileHash(pagePath, currentPage),
    sha256(priorPage),
  );

  const unrelatedEdit = `${currentPage}\n// unrelated protected presentation edit\n`;
  assert.notEqual(
    indexProtectedFileHash(pagePath, unrelatedEdit),
    indexProtectedFileHash(pagePath, currentPage),
  );
});
