import { eq, ne, asc, sql, and } from "drizzle-orm";
import { db } from "./index";
import {
  organizations,
  organizationMemberships,
  jurisdictions,
} from "./schema";

// ---------------------------------------------------------------------------
// Organizations (international memberships) — enriched read layer for the
// Civica Data tab's Organizations section.
//
// The shared `getInternationalMembershipsBySlugs` in queries.ts returns the
// minimum a row needs (org id/name/type, role, joinDate). This section-local
// query deepens that: it also pulls the org's structural facts that already
// live in the `organizations` table (founded year, total member count, HQ
// country, Wikidata QID) and resolves the HQ slug to a display name, plus —
// in one extra round-trip — a small set of notable fellow members per org so
// the section can show real co-membership context.
//
// Every field below is a real column; nothing is generated. Where a column is
// null (e.g. G7/G20 carry no HQ country), the UI degrades to an honest
// "no source" / omitted slot rather than inventing a value.
// ---------------------------------------------------------------------------

export interface OrgMembershipDetail {
  orgId: string;
  orgSlug: string;
  /** Short name / abbreviation, e.g. "NATO". */
  orgName: string;
  /** Expanded name, e.g. "North Atlantic Treaty Organization". */
  orgFullName: string;
  /** security | regional | trade | un | cultural | … */
  orgType: string;
  /** Year the organization was founded (null if unknown). */
  foundedYear: number | null;
  /**
   * Total members of the organization as seeded (e.g. NATO 32, UN 249).
   * This is the org-wide count, NOT this country's membership.
   */
  totalMembers: number | null;
  /** HQ host jurisdiction slug, when known (e.g. "belgium"). */
  hqSlug: string | null;
  /** HQ host display name resolved from the slug (e.g. "Belgium"). */
  hqName: string | null;
  /** Wikidata QID for an external authority link (e.g. "Q7184"). */
  wikidataQid: string | null;
  /** This country's accession date (date string) — never null in the seed. */
  joinDate: string | null;
  joinDatePrecision: "day" | "year" | "unknown";
  endDate: string | null;
  endDatePrecision: "day" | "year" | "unknown";
  /** founding | permanent | observer | null. */
  role: string | null;
  status: "current" | "former" | "withdrawn" | "suspended";
  disputed: boolean;
  sourceId: string;
  sourceUrl: string;
  sourceLicense: string;
  sourceRetrievedAt: string;
  upstreamVintage: string;
}

export interface OrgCoMember {
  name: string;
  slug: string;
  role: string | null;
}

export interface OrgCoMembership {
  /** A few notable fellow members of the org (curated-major first). */
  notable: OrgCoMember[];
  /** True total count of OTHER members in the org (excludes this country). */
  others: number;
}

export interface CountryOrganizationsData {
  memberships: OrgMembershipDetail[];
  /** orgId → co-membership context. Only populated for orgs worth showing. */
  coMembership: Record<string, OrgCoMembership>;
  /** Orgs whose HQ this country hosts (display names), e.g. ["UNESCO", …]. */
  hostsOrgs: { name: string; slug: string }[];
}

// Major powers / large blocs surfaced first when listing notable co-members.
// This is purely a display-ordering hint over REAL members — it never adds a
// country that is not actually in the org. Anything not in this list falls
// back to alphabetical order.
const NOTABLE_PRIORITY: Record<string, number> = {
  "united-states": 0,
  china: 1,
  japan: 2,
  germany: 3,
  india: 4,
  "united-kingdom": 5,
  france: 6,
  italy: 7,
  brazil: 8,
  canada: 9,
  russia: 10,
  "south-korea": 11,
  australia: 12,
  spain: 13,
  mexico: 14,
};

const MAX_NOTABLE = 5;
// Above this size an org is effectively universal (UN/IMF/WHO/WTO/IAEA/UNESCO,
// all ~249 members). Co-membership context there is noise — "alongside 248
// others" tells the reader nothing — so we skip it for those orgs and let the
// UI lean on the total-member scale figure instead.
const UNIVERSAL_THRESHOLD = 120;

/**
 * Enriched memberships + co-membership context + HQ-host list for one country.
 * Single jurisdictionId in, fully shaped out. Pre-sorted by (type, name) to
 * match the section's grouped layout.
 */
export async function getCountryOrganizationsData(
  jurisdictionId: string,
): Promise<CountryOrganizationsData> {
  // 1. This country's memberships, joined to org structural facts and the
  //    HQ-host jurisdiction name (LEFT JOIN — HQ slug may be null or may not
  //    resolve to a jurisdiction).
  const hq = sql`hq_juris`;
  const rows = await db
    .select({
      orgId: organizations.id,
      orgSlug: organizations.slug,
      orgName: organizations.name,
      orgFullName: organizations.fullName,
      orgType: organizations.type,
      foundedYear: organizations.foundedYear,
      totalMembers: organizations.memberCount,
      hqSlug: organizations.hqCountry,
      hqName: sql<string | null>`${hq}.name`,
      wikidataQid: organizations.wikidataQid,
      joinDate: organizationMemberships.joinDate,
      joinDatePrecision: organizationMemberships.joinDatePrecision,
      endDate: organizationMemberships.endDate,
      endDatePrecision: organizationMemberships.endDatePrecision,
      role: organizationMemberships.role,
      status: organizationMemberships.status,
      disputed: organizationMemberships.disputed,
      sourceId: organizationMemberships.sourceId,
      sourceUrl: organizationMemberships.sourceUrl,
      sourceLicense: organizationMemberships.sourceLicense,
      sourceRetrievedAt: organizationMemberships.sourceRetrievedAt,
      upstreamVintage: organizationMemberships.upstreamVintage,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizationMemberships.orgId, organizations.id),
    )
    .leftJoin(
      sql`jurisdictions AS hq_juris`,
      sql`${hq}.slug = ${organizations.hqCountry}`,
    )
    .where(
      and(
        eq(organizationMemberships.jurisdictionId, jurisdictionId),
        ne(organizationMemberships.status, "unverified_legacy"),
      ),
    )
    .orderBy(asc(organizations.type), asc(organizations.name));

  const memberships: OrgMembershipDetail[] = rows.map((r) => ({
    orgId: r.orgId,
    orgSlug: r.orgSlug,
    orgName: r.orgName,
    orgFullName: r.orgFullName,
    orgType: r.orgType,
    foundedYear: r.foundedYear ?? null,
    totalMembers: r.totalMembers ?? null,
    hqSlug: r.hqSlug ?? null,
    hqName: r.hqName ?? null,
    wikidataQid: r.wikidataQid ?? null,
    joinDate:
      r.joinDate == null
        ? null
        : typeof r.joinDate === "string"
          ? r.joinDate
          : new Date(r.joinDate).toISOString().slice(0, 10),
    joinDatePrecision: r.joinDatePrecision as "day" | "year" | "unknown",
    endDate:
      r.endDate == null
        ? null
        : typeof r.endDate === "string"
          ? r.endDate
          : new Date(r.endDate).toISOString().slice(0, 10),
    endDatePrecision: r.endDatePrecision as "day" | "year" | "unknown",
    role: r.role ?? null,
    status: r.status as "current" | "former" | "withdrawn" | "suspended",
    disputed: r.disputed,
    sourceId: r.sourceId!,
    sourceUrl: r.sourceUrl!,
    sourceLicense: r.sourceLicense!,
    sourceRetrievedAt: new Date(r.sourceRetrievedAt!).toISOString(),
    upstreamVintage: r.upstreamVintage!,
  }));

  // 2. Co-membership context. Only worth fetching for non-universal orgs that
  //    this country actually belongs to.
  const eligible = memberships.filter(
    (m) =>
      (m.totalMembers ?? 0) > 1 && (m.totalMembers ?? 0) <= UNIVERSAL_THRESHOLD,
  );

  const coMembership: Record<string, OrgCoMembership> = {};

  if (eligible.length > 0) {
    const eligibleOrgIds = eligible.map((m) => m.orgId);
    // All fellow members (excluding this country) across the eligible orgs in
    // one round-trip. Bounded set (≤ ~36 per org × a handful of orgs).
    const fellows = await db
      .select({
        orgId: organizationMemberships.orgId,
        name: jurisdictions.name,
        slug: jurisdictions.slug,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(
        jurisdictions,
        eq(organizationMemberships.jurisdictionId, jurisdictions.id),
      )
      .where(
        and(
          sql`${organizationMemberships.orgId} IN ${eligibleOrgIds}`,
          ne(organizationMemberships.jurisdictionId, jurisdictionId),
          eq(organizationMemberships.status, "current"),
        ),
      );

    const byOrg = new Map<string, OrgCoMember[]>();
    for (const f of fellows) {
      const list = byOrg.get(f.orgId) ?? [];
      list.push({ name: f.name, slug: f.slug, role: f.role ?? null });
      byOrg.set(f.orgId, list);
    }

    for (const m of eligible) {
      const all = byOrg.get(m.orgId) ?? [];
      if (all.length === 0) continue;
      const sorted = [...all].sort((a, b) => {
        const pa = NOTABLE_PRIORITY[a.slug];
        const pb = NOTABLE_PRIORITY[b.slug];
        if (pa != null && pb != null) return pa - pb;
        if (pa != null) return -1;
        if (pb != null) return 1;
        return a.name.localeCompare(b.name);
      });
      coMembership[m.orgId] = {
        notable: sorted.slice(0, MAX_NOTABLE),
        others: all.length,
      };
    }
  }

  // 3. Orgs whose HQ this country hosts (e.g. France hosts UNESCO, OECD, …).
  const country = await db
    .select({ slug: jurisdictions.slug })
    .from(jurisdictions)
    .where(eq(jurisdictions.id, jurisdictionId))
    .limit(1);

  let hostsOrgs: { name: string; slug: string }[] = [];
  if (country[0]) {
    const hosted = await db
      .select({ name: organizations.name, slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.hqCountry, country[0].slug))
      .orderBy(asc(organizations.name));
    hostsOrgs = hosted;
  }

  return { memberships, coMembership, hostsOrgs };
}
