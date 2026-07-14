import { config } from "dotenv";

config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { getTableColumns } from "drizzle-orm";
import {
  MEMBERSHIPS,
  ORGANIZATIONS,
  getMemberCount,
  getOrgMemberCountryFallback,
} from "../src/lib/data/international-organizations";
import {
  ORGANIZATION_DATABASE_SLUGS,
  ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
  ORGANIZATION_MEMBERSHIP_RETRIEVED_AT,
  ORGANIZATION_MEMBERSHIP_SOURCE_ID,
  ORGANIZATION_MEMBERSHIP_SOURCES,
  releaseOrganizationMembership,
} from "../src/lib/organizations/membership-release";
import { organizationMemberships, organizations } from "../src/lib/db/schema";
import { sourceRights } from "../src/lib/rights/manifest";

const LIVE = process.argv.includes("--live");
const errors: string[] = [];
const read = (path: string) => readFileSync(path, "utf8");
const fail = (message: string) => errors.push(message);

function validateStaticContract() {
  if (ORGANIZATIONS.length !== 23)
    fail(`expected 23 organization identities; found ${ORGANIZATIONS.length}`);
  if (MEMBERSHIPS.length !== 446)
    fail(`expected 446 retained relationships; found ${MEMBERSHIPS.length}`);

  const ids = new Set(ORGANIZATIONS.map((org) => org.id));
  const dbSlugs = new Set(Object.values(ORGANIZATION_DATABASE_SLUGS));
  if (ids.size !== ORGANIZATIONS.length)
    fail("organization ids are not unique");
  if (dbSlugs.size !== ORGANIZATIONS.length)
    fail("organization DB slugs are not unique");

  for (const org of ORGANIZATIONS) {
    const source = ORGANIZATION_MEMBERSHIP_SOURCES[org.id];
    if (!source) {
      fail(`${org.id}: source registry entry is missing`);
      continue;
    }
    if (!ORGANIZATION_DATABASE_SLUGS[org.id])
      fail(`${org.id}: stable DB slug is missing`);
    if (!source.url.startsWith("https://"))
      fail(`${org.id}: source URL is not HTTPS`);
    if (!source.license.trim()) fail(`${org.id}: rights posture is blank`);
    const raw = MEMBERSHIPS.filter((row) => row.orgId === org.id);
    const current = raw.filter((row) => row.status !== "withdrawn");
    if (source.coverage === "complete" && org.memberCount !== current.length) {
      fail(
        `${org.id}: complete roster count ${current.length} differs from published memberCount ${org.memberCount}`,
      );
    }
  }

  for (const membership of MEMBERSHIPS) {
    if (!ids.has(membership.orgId))
      fail(`relationship references unknown org ${membership.orgId}`);
    const released = releaseOrganizationMembership(membership);
    if (
      released.source.dateCoverage === "unavailable" &&
      (released.joinYear != null || released.joinDatePrecision !== "unknown")
    ) {
      fail(
        `${membership.orgId}/${membership.countryId}: unsupported accession year escaped quarantine`,
      );
    }
    if (released.status === "withdrawn" && released.endYear == null) {
      fail(
        `${membership.orgId}/${membership.countryId}: withdrawn row has no end year`,
      );
    }
  }

  const withdrawn = MEMBERSHIPS.filter((row) => row.status === "withdrawn");
  if (
    withdrawn.length !== 3 ||
    withdrawn.some(
      (row) =>
        row.orgId !== "ecowas" ||
        !["bfa", "mli", "ner"].includes(row.countryId) ||
        row.endYear !== 2025,
    )
  ) {
    fail("ECOWAS historical interval fixture drifted");
  }
  const observer = MEMBERSHIPS.find(
    (row) => row.orgId === "oif" && row.countryId === "ken",
  );
  if (observer?.role !== "observer") fail("OIF observer fixture drifted");
  if (getMemberCount("ecowas") !== 12)
    fail("ECOWAS published current-member count drifted");

  if (!getOrgMemberCountryFallback("esh")) {
    fail("Western Sahara fallback identity is missing");
  }

  const orgColumns = Object.keys(getTableColumns(organizations));
  const membershipColumns = Object.keys(
    getTableColumns(organizationMemberships),
  );
  for (const column of [
    "sourceId",
    "sourceUrl",
    "sourceLicense",
    "sourceRetrievedAt",
    "upstreamVintage",
  ]) {
    if (!orgColumns.includes(column))
      fail(`organizations.${column} is missing`);
  }
  for (const column of [
    "joinDate",
    "joinDatePrecision",
    "endDate",
    "endDatePrecision",
    "role",
    "status",
    "statusNote",
    "disputed",
    "sourceId",
    "sourceUrl",
    "sourceLicense",
    "sourceRetrievedAt",
    "upstreamVintage",
  ]) {
    if (!membershipColumns.includes(column))
      fail(`organization_memberships.${column} is missing`);
  }

  const migration = read("drizzle/authoritative/0032_sparkling_genesis.sql");
  for (const token of [
    "DEFAULT 'unverified_legacy'",
    "organization_memberships_source_bundle_check",
    "organization_memberships_terminal_date_check",
    "organizations_source_bundle_check",
  ]) {
    if (!migration.includes(token))
      fail(`authoritative migration lacks ${token}`);
  }

  const retiredSeed = read("scripts/seed-organizations.ts");
  if (
    !retiredSeed.includes("is retired") ||
    retiredSeed.includes("__un_all__")
  ) {
    fail("the destructive blanket organization seed is not retired");
  }
  const sync = read("scripts/sync-organization-memberships.ts");
  if (
    !sync.includes("markSourcesSyncedTransactionQuery") ||
    !sync.includes("unverified_legacy") ||
    !sync.includes("neonSql.transaction")
  ) {
    fail("canonical writer lacks freshness stamping or legacy quarantine");
  }
  const queries = read("src/lib/db/queries-organizations.ts");
  if (
    !queries.includes('ne(organizationMemberships.status, "unverified_legacy")')
  ) {
    fail("country read boundary does not exclude unverified legacy rows");
  }
  const compareQuery = read("src/lib/db/queries.ts");
  if (
    !compareQuery.includes(
      "organizationMemberships.status} <> 'unverified_legacy'",
    )
  ) {
    fail("comparison read boundary does not exclude unverified legacy rows");
  }
  const atlasLoader = read("src/lib/atlas/load-atlas-data.ts");
  if (!atlasLoader.includes("organizationMemberships.status} = 'current'")) {
    fail(
      "Atlas aggregate loader does not restrict memberships to current relationships",
    );
  }
  const route = read("src/app/api/countries/[slug]/international/route.ts");
  for (const token of [
    "release",
    "provenance",
    "upstreamVintage",
    "coverage",
  ]) {
    if (!route.includes(token)) fail(`public API omits ${token}`);
  }
  const factbook = read("src/components/factbook/FactbookOrganizations.tsx");
  if (
    !factbook.includes("absence is not evidence of non-membership") ||
    !factbook.includes("m.sourceUrl")
  ) {
    fail("country UI lacks selected-roster caveat or exact source link");
  }
  const compare = read("src/components/compare/CompareInternational.tsx");
  if (
    !compare.includes('m.status === "current"') ||
    !compare.includes("m.sourceUrl")
  ) {
    fail(
      "comparison UI does not distinguish current/historical relationships with sources",
    );
  }
  const rights = sourceRights(ORGANIZATION_MEMBERSHIP_SOURCE_ID);
  if (rights?.publicExport !== "blocked" || rights.reviewStatus !== "pending") {
    fail(
      "composite organization source must remain blocked from bulk export pending rights review",
    );
  }
}

async function validateLiveContract() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(databaseUrl);

  const [summary] = await sql`
    SELECT
      count(*) FILTER (WHERE om.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION})::int AS released,
      count(*) FILTER (WHERE om.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION} AND om.status = 'current')::int AS current,
      count(*) FILTER (WHERE om.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION} AND om.status = 'withdrawn')::int AS withdrawn,
      count(*) FILTER (WHERE om.status = 'unverified_legacy')::int AS legacy,
      count(*) FILTER (
        WHERE om.status <> 'unverified_legacy'
          AND (om.source_id IS NULL OR om.source_url IS NULL OR om.source_license IS NULL OR om.source_retrieved_at IS NULL OR om.upstream_vintage IS NULL)
      )::int AS invalid_provenance
    FROM organization_memberships om
  `;
  if (summary.released !== 445)
    fail(`live release has ${summary.released} rows; expected 445`);
  if (summary.current !== 442)
    fail(`live release has ${summary.current} current rows; expected 442`);
  if (summary.withdrawn !== 3)
    fail(`live release has ${summary.withdrawn} withdrawn rows; expected 3`);
  if (summary.legacy < 1)
    fail("legacy seed evidence was deleted instead of quarantined");
  if (summary.invalid_provenance !== 0)
    fail(
      `${summary.invalid_provenance} public rows have incomplete provenance`,
    );

  const [orgSummary] = await sql`
    SELECT count(*)::int AS sourced
    FROM organizations
    WHERE upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}
      AND source_id = ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}
      AND source_url IS NOT NULL
      AND source_license IS NOT NULL
      AND source_retrieved_at IS NOT NULL
  `;
  if (orgSummary.sourced !== 23)
    fail(
      `live release has ${orgSummary.sourced} sourced org identities; expected 23`,
    );

  const [ecowas] = await sql`
    SELECT
      count(*) FILTER (WHERE om.status = 'current')::int AS current,
      count(*) FILTER (WHERE om.status = 'withdrawn')::int AS withdrawn
    FROM organization_memberships om
    JOIN organizations o ON o.id = om.org_id
    WHERE o.slug = 'ecowas' AND om.upstream_vintage = ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}
  `;
  if (ecowas.current !== 12 || ecowas.withdrawn !== 3)
    fail("live ECOWAS current/historical split drifted");

  const [observer] = await sql`
    SELECT count(*)::int AS count
    FROM organization_memberships om
    JOIN organizations o ON o.id = om.org_id
    JOIN jurisdictions j ON j.id = om.jurisdiction_id
    WHERE o.slug = 'la-francophonie' AND lower(j.iso3) = 'ken'
      AND om.role = 'observer' AND om.status = 'current'
  `;
  if (observer.count !== 1) fail("live OIF observer relationship is missing");

  const [falseUniversal] = await sql`
    SELECT count(*)::int AS count
    FROM organization_memberships om
    JOIN organizations o ON o.id = om.org_id
    JOIN jurisdictions j ON j.id = om.jurisdiction_id
    WHERE o.slug IN ('united-nations', 'who', 'unesco', 'wto', 'imf', 'iaea')
      AND upper(j.iso3) IN ('TWN', 'ATA')
      AND om.status <> 'unverified_legacy'
  `;
  if (falseUniversal.count !== 0)
    fail(
      "blanket universal membership claims remain public for Taiwan or Antarctica",
    );

  const [source] = await sql`
    SELECT last_sync_at
    FROM sources
    WHERE id = ${ORGANIZATION_MEMBERSHIP_SOURCE_ID}
  `;
  if (
    !source?.last_sync_at ||
    new Date(source.last_sync_at).toISOString() !==
      ORGANIZATION_MEMBERSHIP_RETRIEVED_AT
  ) {
    fail(
      "organization roster source freshness does not equal the frozen retrieval time",
    );
  }
}

async function main() {
  validateStaticContract();
  if (LIVE) await validateLiveContract();
  console.log("=== ATL-012 organization-membership validation ===\n");
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(
    `PASS — ${ORGANIZATION_MEMBERSHIP_RELEASE_VERSION}: 23 identities, 446 retained relationships, exact source/vintage/rights, legacy quarantine${LIVE ? ", and live DB invariants" : ""}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
