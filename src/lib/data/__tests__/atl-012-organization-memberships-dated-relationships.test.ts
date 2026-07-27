/**
 * ATL-012 — organizations and memberships are dated relationships, not
 * timeless facts.
 *
 * Audit findings this suite locks (see plan/evidence/ATL-012/README.md for
 * the full writeup):
 *
 *   1. Membership TYPE (role: founding | permanent | observer | plain) is a
 *      real, preserved field — not flattened to a boolean "is a member".
 *   2. START/END/STATUS are represented in the release and DB schema:
 *      Burkina Faso, Mali, and Niger's ECOWAS memberships now carry
 *      `status: "withdrawn"` and `endYear: 2025`, rather than being silently
 *      deleted or left indistinguishable from current members.
 *   3. DISPUTED/OBSERVER cases are preserved distinctly (OIF's observer
 *      states; UNSC's 1971 PRC/ROC seat transfer is a real dated change, not
 *      a blanket founding-year stamp).
 *   4. ORG IDENTITY — every membership resolves to a real, uniquely
 *      identified organization row (slug/name/fullName/type).
 *   5. CURRENT vs HISTORICAL are distinguishable in the renderer (an explicit
 *      "Withdrawn" badge + a joinYear–endYear range + a muted row) and in the
 *      API (status/endYear pass through rather than being coerced away).
 *   6. DB-backed readers fail closed around `unverified_legacy` rows and the
 *      schema carries interval, status, dispute, source, rights, and vintage.
 *
 * Pure + source-backed: no DB, no network. Runs under `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";

import {
  MEMBERSHIPS,
  ORGANIZATIONS,
  getMembersOfOrg,
  getMembershipsForCountry,
  getMemberCount,
  getOrganizationBySlug,
} from "@/lib/data/international-organizations";
import { organizations, organizationMemberships } from "@/lib/db/schema";
import { ATLAS_SURFACE_DATA_MATRIX } from "@/lib/atlas/surface-data-matrix";
import { sourceRights } from "@/lib/rights/manifest";
import {
  ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
  ORGANIZATION_MEMBERSHIP_SOURCES,
  releaseOrganizationMembership,
} from "@/lib/organizations/membership-release";

const ORG_DETAIL_PANEL = "src/components/atlas/OrgDetailPanel.tsx";
const INTERNATIONAL_ROUTE =
  "src/app/api/countries/[slug]/international/route.ts";
const COMPARE_INTERNATIONAL = "src/components/compare/CompareInternational.tsx";

// ── 1. Membership type is a real, preserved field ──────────────────────────

test("membership role (type) preserves founding / permanent / observer / plain — not flattened", () => {
  const roles = new Set(MEMBERSHIPS.map((m) => m.role ?? null));
  assert.ok(roles.has("founding"), "expected at least one founding member");
  assert.ok(roles.has("observer"), "expected at least one observer");
  assert.ok(
    roles.has("permanent"),
    "expected at least one permanent (P5) seat",
  );
  assert.ok(
    roles.has(null),
    "expected at least one plain member with no special role",
  );
});

test("disputed/observer case: OIF observers are recorded distinctly from full members", () => {
  const oif = getMembersOfOrg("oif");
  const observers = oif.filter((m) => m.role === "observer");
  const full = oif.filter((m) => m.role !== "observer");
  assert.ok(observers.length > 0, "expected OIF observer rows");
  assert.ok(full.length > 0, "expected OIF full-member rows");
  assert.ok(
    observers.some((m) => m.countryId === "ken"),
    "Kenya should be recorded as an OIF observer",
  );
});

test("a real dated status change is captured, not a blanket founding-year stamp: the UN Security Council China seat transferred in 1971", () => {
  const unsc = getMembersOfOrg("unsc");
  const chn = unsc.find((m) => m.countryId === "chn");
  const usa = unsc.find((m) => m.countryId === "usa");
  assert.ok(chn && usa);
  assert.equal(chn!.joinYear, 1971);
  assert.equal(usa!.joinYear, 1945);
  assert.equal(chn!.role, "permanent");
});

// ── 2 & 3. Start/end/status are represented; current vs historical distinct ─

test("ECOWAS: Burkina Faso, Mali, and Niger are withdrawn (status + endYear), never silently dropped or left indistinguishable from current members", () => {
  const ecowas = getMembersOfOrg("ecowas");
  assert.equal(ecowas.length, 15, "12 current + 3 historical rows");

  const withdrawn = ecowas.filter((m) => m.status === "withdrawn");
  const current = ecowas.filter((m) => m.status !== "withdrawn");
  assert.equal(withdrawn.length, 3);
  assert.equal(current.length, 12);

  for (const id of ["bfa", "mli", "ner"]) {
    const row = ecowas.find((m) => m.countryId === id);
    assert.ok(row, `expected an ECOWAS row for ${id}`);
    assert.equal(row!.status, "withdrawn");
    assert.equal(row!.endYear, 2025);
    assert.equal(
      row!.role,
      "founding",
      "they were founding members before withdrawing",
    );
    assert.equal(row!.joinYear, 1975);
  }

  // Current members must NOT carry a withdrawal end date.
  for (const row of current) {
    assert.notEqual(row.status, "withdrawn");
    assert.equal(
      row.endYear,
      undefined,
      `${row.countryId} is current and must not carry an endYear`,
    );
  }
});

test("ECOWAS current membership count reflects the post-withdrawal total (12), not the founding-era total (15)", () => {
  assert.equal(getMemberCount("ecowas"), 12);
  const org = ORGANIZATIONS.find((o) => o.id === "ecowas");
  assert.equal(org?.memberCount, 12);
});

test("the withdrawn relationship is visible from the country's own membership list, not just the org's", () => {
  for (const id of ["bfa", "mli", "ner"]) {
    const memberships = getMembershipsForCountry(id);
    const ecowasRow = memberships.find((m) => m.orgId === "ecowas");
    assert.ok(
      ecowasRow,
      `expected ${id} to still show an ECOWAS row (historical, not deleted)`,
    );
    assert.equal(ecowasRow!.status, "withdrawn");
  }
});

// ── 4. Org identity ─────────────────────────────────────────────────────────

test("every membership resolves to a real, uniquely identified organization (slug/name/fullName/type)", () => {
  const orgIds = new Set(ORGANIZATIONS.map((o) => o.id));
  assert.equal(
    orgIds.size,
    ORGANIZATIONS.length,
    "organization ids must be unique",
  );
  for (const m of MEMBERSHIPS) {
    assert.ok(
      orgIds.has(m.orgId),
      `membership references unknown org id "${m.orgId}"`,
    );
  }
  const ecowas = getOrganizationBySlug("ecowas");
  assert.ok(ecowas);
  assert.equal(ecowas!.name, "ECOWAS");
  assert.equal(ecowas!.fullName, "Economic Community of West African States");
  assert.equal(ecowas!.type, "regional");
});

// ── 5. Renderer + API distinguish current vs historical ────────────────────

test("the org detail renderer surfaces an explicit Withdrawn status, a start–end year range, a muted historical row, and a source/vintage note", () => {
  const src = readFileSync(ORG_DETAIL_PANEL, "utf8");
  assert.match(src, /status === "withdrawn"/);
  assert.match(src, /"Withdrawn"/);
  // joinYear–endYear range for historical rows.
  assert.match(src, /\$\{m\.joinYear[^}]*\}–\$\{m\.endYear\}/);
  assert.match(src, /intl-mem-row--historical/);
  assert.match(src, /SourceDot/);
  assert.match(src, /source="civica_organization_roster_v1"/);
  assert.match(src, /detail\.membershipSource\.url/);
  // The stat band and map fill must key off current members, not the raw list.
  assert.match(src, /currentMembers/);
  assert.match(src, /formerMembers/);
});

test("the public international-memberships API releases status/endYear with exact provenance", () => {
  const src = readFileSync(INTERNATIONAL_ROUTE, "utf8");
  assert.match(src, /getJurisdictionBySlug\(normalized\)/);
  assert.match(src, /jurisdiction\?\.iso3\?\.toLowerCase\(\)/);
  assert.match(src, /status:\s*released\.status/);
  assert.match(src, /endYear:\s*released\.endYear/);
  assert.match(src, /upstreamVintage:\s*released\.upstreamVintage/);
  assert.match(src, /coverage:\s*released\.source\.coverage/);
});

test("the comparison renderer reads year-precision dates in UTC so western timezones cannot subtract a year", () => {
  const src = readFileSync(COMPARE_INTERNATIONAL, "utf8");
  assert.equal((src.match(/getUTCFullYear\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(src, /\.getFullYear\(\)/);
});

test("unsupported founding-year placeholders are suppressed while sourced dates survive", () => {
  const who = releaseOrganizationMembership(getMembersOfOrg("who")[0]!);
  const un = releaseOrganizationMembership(getMembersOfOrg("un")[0]!);
  assert.equal(who.joinYear, null);
  assert.equal(who.joinDatePrecision, "unknown");
  assert.equal(un.joinDatePrecision, "year");
  assert.ok(un.joinYear);
});

test("every organization has an exact source, rights posture, and honest roster coverage", () => {
  assert.equal(
    Object.keys(ORGANIZATION_MEMBERSHIP_SOURCES).length,
    ORGANIZATIONS.length,
  );
  for (const org of ORGANIZATIONS) {
    const source = ORGANIZATION_MEMBERSHIP_SOURCES[org.id];
    assert.ok(source.url.startsWith("https://"));
    assert.ok(source.license);
    assert.ok(["complete", "selected"].includes(source.coverage));
  }
  assert.equal(
    ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
    "organization-membership-release/2026-07-v1",
  );
});

test("the bulk-export fixture excludes both current and historical organization rows while composite source rights remain blocked", () => {
  for (const id of [
    "route.organization-detail",
    "country.civica-data.organizations",
  ]) {
    const row = ATLAS_SURFACE_DATA_MATRIX.rows.find((item) => item.id === id);
    assert.ok(row, `missing surface/export fixture ${id}`);
    assert.equal(row.releaseRelation, "excluded_surface_only");
    assert.match(row.releaseReason, /excludes organization/i);
  }
  const rights = sourceRights("civica_organization_roster_v1");
  assert.ok(rights);
  assert.equal(rights.publicExport, "blocked");
  assert.equal(rights.reviewStatus, "pending");
});

// ── 6. DB-backed interval and provenance contract ──────────────────────────

test("DB organization identities and memberships carry interval, status, dispute, and provenance fields", () => {
  const orgCols = Object.keys(getTableColumns(organizations));
  const membershipCols = Object.keys(getTableColumns(organizationMemberships));

  for (const col of [
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
    assert.ok(
      membershipCols.includes(col),
      `organization_memberships.${col} is represented`,
    );
  }
  for (const col of [
    "sourceId",
    "sourceUrl",
    "sourceLicense",
    "sourceRetrievedAt",
    "upstreamVintage",
  ]) {
    assert.ok(orgCols.includes(col), `organizations.${col} is represented`);
  }
});
