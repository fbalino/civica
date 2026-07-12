/**
 * ATL-012 — organizations and memberships are dated relationships, not
 * timeless facts.
 *
 * Audit findings this suite locks (see plan/evidence/ATL-012/README.md for
 * the full writeup):
 *
 *   1. Membership TYPE (role: founding | permanent | observer | plain) is a
 *      real, preserved field — not flattened to a boolean "is a member".
 *   2. START/END/STATUS are represented for the one dataset where they can be
 *      (the curated `international-organizations.ts` MEMBERSHIPS array, which
 *      backs `/organizations/[slug]` and `/api/countries/[slug]/international`):
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
 *   6. A genuine, DEFERRED gap: the DB-backed `organizations` /
 *      `organization_memberships` tables (used by the country Civica Data
 *      tab and /compare) have no status/end-date/disputed/source_id columns
 *      at all — adding them needs a schema migration, which is out of scope
 *      here. This suite locks that absence as a structural fact so the gap
 *      stays visible until DAT-owned schema work closes it.
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

const ORG_DETAIL_PANEL = "src/components/atlas/OrgDetailPanel.tsx";
const INTERNATIONAL_ROUTE =
  "src/app/api/countries/[slug]/international/route.ts";

// ── 1. Membership type is a real, preserved field ──────────────────────────

test("membership role (type) preserves founding / permanent / observer / plain — not flattened", () => {
  const roles = new Set(MEMBERSHIPS.map((m) => m.role ?? null));
  assert.ok(roles.has("founding"), "expected at least one founding member");
  assert.ok(roles.has("observer"), "expected at least one observer");
  assert.ok(roles.has("permanent"), "expected at least one permanent (P5) seat");
  assert.ok(roles.has(null), "expected at least one plain member with no special role");
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
    assert.equal(row!.role, "founding", "they were founding members before withdrawing");
    assert.equal(row!.joinYear, 1975);
  }

  // Current members must NOT carry a withdrawal end date.
  for (const row of current) {
    assert.notEqual(row.status, "withdrawn");
    assert.equal(row.endYear, undefined, `${row.countryId} is current and must not carry an endYear`);
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
    assert.ok(ecowasRow, `expected ${id} to still show an ECOWAS row (historical, not deleted)`);
    assert.equal(ecowasRow!.status, "withdrawn");
  }
});

// ── 4. Org identity ─────────────────────────────────────────────────────────

test("every membership resolves to a real, uniquely identified organization (slug/name/fullName/type)", () => {
  const orgIds = new Set(ORGANIZATIONS.map((o) => o.id));
  assert.equal(orgIds.size, ORGANIZATIONS.length, "organization ids must be unique");
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
  assert.match(src, /source="civica_curated"/);
  // The stat band and map fill must key off current members, not the raw list.
  assert.match(src, /currentMembers/);
  assert.match(src, /formerMembers/);
});

test("the public international-memberships API passes status/endYear through rather than coercing every row to current", () => {
  const src = readFileSync(INTERNATIONAL_ROUTE, "utf8");
  assert.match(src, /status:\s*m\.status\s*\?\?\s*"current"/);
  assert.match(src, /endYear:\s*m\.endYear\s*\?\?\s*null/);
});

// ── 6. Deferred gap: DB-backed tables still lack status/end-date/source ────

test("DEFERRED (needs a schema migration, not fixed by ATL-012): the DB organizations/organization_memberships tables have no status, end-date, disputed, or source_id columns", () => {
  const orgCols = Object.keys(getTableColumns(organizations));
  const membershipCols = Object.keys(getTableColumns(organizationMemberships));

  // What IS represented today.
  assert.ok(membershipCols.includes("joinDate"), "start date is represented");
  assert.ok(membershipCols.includes("role"), "membership type is represented");
  assert.ok(orgCols.includes("wikidataQid"), "org identity is represented");

  // What is genuinely missing — if this assertion starts failing, the gap has
  // been closed by a migration and this test (and the ATL-012 README) should
  // be updated to reflect it, not silently relaxed.
  for (const col of ["endDate", "status", "disputed", "sourceId"]) {
    assert.ok(
      !membershipCols.includes(col),
      `organization_memberships unexpectedly has a "${col}" column — update ATL-012 evidence`,
    );
  }
  assert.ok(
    !orgCols.includes("sourceId"),
    'organizations unexpectedly has a "sourceId" column — update ATL-012 evidence',
  );
});
