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
