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
  const priorManifest = currentManifest.replace(
    /  spec\(\n    "civica_organization_roster_v1",[\s\S]*?    "restricted-no-redistribution",\n  \),\n/,
    "",
  );
  assert.notEqual(currentManifest, priorManifest);
  assert.equal(
    indexProtectedFileHash(manifestPath, currentManifest),
    sha256(priorManifest),
  );
});

test("the Atlas-only organization adapter is excluded from Index semantic drift", () => {
  const registryPath = "src/lib/data/production-adapter-registry.ts";
  const currentRegistry = readFileSync(registryPath, "utf8");
  const priorRegistry = currentRegistry.replace(
    /    \{\n      id: "atlas\.organization-memberships",[\s\S]*?    \},\n/,
    "",
  );
  assert.notEqual(currentRegistry, priorRegistry);
  assert.equal(
    indexProtectedFileHash(registryPath, currentRegistry),
    sha256(priorRegistry),
  );
});

test("the Atlas-only Bills coverage state is excluded from Index semantic drift", () => {
  const pagePath = "src/app/(reader)/country/[slug]/civica-data/page.tsx";
  const currentPage = readFileSync(pagePath, "utf8");
  const priorPage = currentPage.replace(
    "  // A valid zero-row result is itself meaningful: the Bills section explains\n" +
      "  // unsupported coverage instead of silently disappearing. A failed lookup\n" +
      "  // remains hidden so an outage is never mislabeled as a coverage gap.\n" +
      "  const hasBills = !!billsResult;\n",
    "  const hasBills = !!billsResult && billsResult.rows.length > 0;\n",
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
