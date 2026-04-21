/**
 * Curated international organizations + memberships for the Atlas.
 * Source of truth for the initial International tab release. Country ids
 * match the 3-letter alpha codes used in `src/components/atlas/data.ts` and
 * in the jurisdictions table (`iso3` column, lowercase).
 *
 * A later task can replace this with Wikidata P463 ingestion into the
 * `organizations` / `organization_memberships` tables.
 */

export type OrgType = "security" | "regional" | "trade" | "un" | "cultural";
export type MemberRole = "founding" | "permanent" | "observer" | null;

export interface Organization {
  id: string;
  slug: string;
  name: string;
  fullName: string;
  type: OrgType;
  foundedYear: number;
  hqCountry?: string;
  description?: string;
  extra?: Record<string, string | number>;
}

export interface Membership {
  orgId: string;
  countryId: string;
  joinYear: number;
  role?: MemberRole;
}

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  security: "Security & Defense",
  regional: "Regional Blocs",
  trade: "Trade & Finance",
  un: "UN System",
  cultural: "Cultural & Language",
};

export const ORG_TYPE_COLOR: Record<OrgType, string> = {
  security: "#D4764E",
  regional: "#4E8BD4",
  trade: "#5CAA6E",
  un: "#9B6DC6",
  cultural: "#8a8370",
};

export const ORG_TYPE_ORDER: OrgType[] = [
  "security",
  "regional",
  "trade",
  "un",
  "cultural",
];

export const ORGANIZATIONS: Organization[] = [
  // UN system
  {
    id: "un",
    slug: "un",
    name: "UN",
    fullName: "United Nations",
    type: "un",
    foundedYear: 1945,
    hqCountry: "usa",
    description: "Global intergovernmental body for peace, security, human rights, and development.",
  },
  {
    id: "unsc",
    slug: "unsc",
    name: "UNSC",
    fullName: "UN Security Council",
    type: "un",
    foundedYear: 1945,
    hqCountry: "usa",
    description: "15-member Council responsible for international peace and security.",
    extra: { seats: 15 },
  },
  {
    id: "who",
    slug: "who",
    name: "WHO",
    fullName: "World Health Organization",
    type: "un",
    foundedYear: 1948,
    hqCountry: "che",
  },
  {
    id: "unesco",
    slug: "unesco",
    name: "UNESCO",
    fullName: "UN Educational, Scientific and Cultural Organization",
    type: "un",
    foundedYear: 1945,
    hqCountry: "fra",
  },

  // Security & Defense
  {
    id: "nato",
    slug: "nato",
    name: "NATO",
    fullName: "North Atlantic Treaty Organization",
    type: "security",
    foundedYear: 1949,
    hqCountry: "bel",
    description: "Transatlantic military alliance for collective defense.",
    extra: { gdpTargetPercent: 2 },
  },

  // Regional blocs
  {
    id: "eu",
    slug: "eu",
    name: "EU",
    fullName: "European Union",
    type: "regional",
    foundedYear: 1993,
    hqCountry: "bel",
    description: "Political and economic union of European states.",
  },
  {
    id: "coe",
    slug: "coe",
    name: "Council of Europe",
    fullName: "Council of Europe",
    type: "regional",
    foundedYear: 1949,
    hqCountry: "fra",
  },
  {
    id: "asean",
    slug: "asean",
    name: "ASEAN",
    fullName: "Association of Southeast Asian Nations",
    type: "regional",
    foundedYear: 1967,
    hqCountry: "idn",
  },
  {
    id: "au",
    slug: "au",
    name: "AU",
    fullName: "African Union",
    type: "regional",
    foundedYear: 2002,
    hqCountry: "eth",
  },
  {
    id: "arableague",
    slug: "arab-league",
    name: "Arab League",
    fullName: "League of Arab States",
    type: "regional",
    foundedYear: 1945,
    hqCountry: "egy",
  },
  {
    id: "oas",
    slug: "oas",
    name: "OAS",
    fullName: "Organization of American States",
    type: "regional",
    foundedYear: 1948,
    hqCountry: "usa",
  },

  // Trade & finance
  {
    id: "wto",
    slug: "wto",
    name: "WTO",
    fullName: "World Trade Organization",
    type: "trade",
    foundedYear: 1995,
    hqCountry: "che",
  },
  {
    id: "imf",
    slug: "imf",
    name: "IMF",
    fullName: "International Monetary Fund",
    type: "trade",
    foundedYear: 1944,
    hqCountry: "usa",
  },
  {
    id: "worldbank",
    slug: "world-bank",
    name: "World Bank",
    fullName: "World Bank Group",
    type: "trade",
    foundedYear: 1944,
    hqCountry: "usa",
  },
  {
    id: "oecd",
    slug: "oecd",
    name: "OECD",
    fullName: "Organisation for Economic Co-operation and Development",
    type: "trade",
    foundedYear: 1961,
    hqCountry: "fra",
  },
  {
    id: "g7",
    slug: "g7",
    name: "G7",
    fullName: "Group of Seven",
    type: "trade",
    foundedYear: 1975,
  },
  {
    id: "g20",
    slug: "g20",
    name: "G20",
    fullName: "Group of Twenty",
    type: "trade",
    foundedYear: 1999,
  },
  {
    id: "brics",
    slug: "brics",
    name: "BRICS",
    fullName: "Brazil, Russia, India, China, South Africa",
    type: "trade",
    foundedYear: 2009,
  },

  // Cultural & language
  {
    id: "commonwealth",
    slug: "commonwealth",
    name: "Commonwealth",
    fullName: "Commonwealth of Nations",
    type: "cultural",
    foundedYear: 1931,
    hqCountry: "gbr",
  },
  {
    id: "oif",
    slug: "oif",
    name: "OIF",
    fullName: "Organisation internationale de la Francophonie",
    type: "cultural",
    foundedYear: 1970,
    hqCountry: "fra",
  },
];

/**
 * Memberships. Each entry links a country (by 3-letter id used in the Atlas)
 * to an organization. Join years follow Wikidata where possible; "founding"
 * role is used for states present at the creation of the body.
 */
export const MEMBERSHIPS: Membership[] = [
  // UN — all Atlas countries are members
  ...[
    ["usa", 1945, "founding"], ["can", 1945, "founding"], ["mex", 1945, "founding"],
    ["bra", 1945, "founding"], ["arg", 1945, "founding"], ["gbr", 1945, "founding"],
    ["fra", 1945, "founding"], ["deu", 1973, null], ["esp", 1955, null],
    ["ita", 1955, null], ["rus", 1945, "founding"], ["egy", 1945, "founding"],
    ["nga", 1960, null], ["zaf", 1945, "founding"], ["ken", 1963, null],
    ["chn", 1945, "founding"], ["ind", 1945, "founding"], ["jpn", 1956, null],
    ["kor", 1991, null], ["sau", 1945, "founding"], ["idn", 1950, null],
    ["aus", 1945, "founding"], ["nzl", 1945, "founding"],
  ].map(([countryId, joinYear, role]) => ({
    orgId: "un",
    countryId: countryId as string,
    joinYear: joinYear as number,
    role: role as MemberRole,
  })),

  // UN Security Council — 5 permanent + rotating. We expose permanent 5.
  { orgId: "unsc", countryId: "usa", joinYear: 1945, role: "permanent" },
  { orgId: "unsc", countryId: "gbr", joinYear: 1945, role: "permanent" },
  { orgId: "unsc", countryId: "fra", joinYear: 1945, role: "permanent" },
  { orgId: "unsc", countryId: "rus", joinYear: 1991, role: "permanent" },
  { orgId: "unsc", countryId: "chn", joinYear: 1971, role: "permanent" },

  // WHO
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","rus","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "who", countryId: c, joinYear: 1948, role: null as MemberRole,
  })),

  // UNESCO
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","rus","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "unesco", countryId: c, joinYear: 1946, role: null as MemberRole,
  })),

  // NATO — founding 12 include USA, UK, France, Italy, Canada; later accessions.
  { orgId: "nato", countryId: "usa", joinYear: 1949, role: "founding" },
  { orgId: "nato", countryId: "gbr", joinYear: 1949, role: "founding" },
  { orgId: "nato", countryId: "fra", joinYear: 1949, role: "founding" },
  { orgId: "nato", countryId: "ita", joinYear: 1949, role: "founding" },
  { orgId: "nato", countryId: "can", joinYear: 1949, role: "founding" },
  { orgId: "nato", countryId: "esp", joinYear: 1982, role: null },
  { orgId: "nato", countryId: "deu", joinYear: 1955, role: null },

  // EU — founding 6: France, Germany, Italy (via EEC 1957 → EU 1993). Spain 1986.
  { orgId: "eu", countryId: "fra", joinYear: 1957, role: "founding" },
  { orgId: "eu", countryId: "deu", joinYear: 1957, role: "founding" },
  { orgId: "eu", countryId: "ita", joinYear: 1957, role: "founding" },
  { orgId: "eu", countryId: "esp", joinYear: 1986, role: null },

  // Council of Europe
  { orgId: "coe", countryId: "fra", joinYear: 1949, role: "founding" },
  { orgId: "coe", countryId: "gbr", joinYear: 1949, role: "founding" },
  { orgId: "coe", countryId: "ita", joinYear: 1949, role: "founding" },
  { orgId: "coe", countryId: "deu", joinYear: 1950, role: null },
  { orgId: "coe", countryId: "esp", joinYear: 1977, role: null },

  // ASEAN founding: Indonesia. Others not in Atlas set.
  { orgId: "asean", countryId: "idn", joinYear: 1967, role: "founding" },

  // AU — founding members: Egypt, Nigeria, South Africa, Kenya present in Atlas.
  { orgId: "au", countryId: "egy", joinYear: 2002, role: "founding" },
  { orgId: "au", countryId: "nga", joinYear: 2002, role: "founding" },
  { orgId: "au", countryId: "zaf", joinYear: 2002, role: "founding" },
  { orgId: "au", countryId: "ken", joinYear: 2002, role: "founding" },

  // Arab League — Egypt, Saudi Arabia (Atlas subset)
  { orgId: "arableague", countryId: "egy", joinYear: 1945, role: "founding" },
  { orgId: "arableague", countryId: "sau", joinYear: 1945, role: "founding" },

  // OAS — Atlas Americas
  { orgId: "oas", countryId: "usa", joinYear: 1948, role: "founding" },
  { orgId: "oas", countryId: "can", joinYear: 1990, role: null },
  { orgId: "oas", countryId: "mex", joinYear: 1948, role: "founding" },
  { orgId: "oas", countryId: "bra", joinYear: 1948, role: "founding" },
  { orgId: "oas", countryId: "arg", joinYear: 1948, role: "founding" },

  // WTO
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "wto", countryId: c, joinYear: c === "chn" ? 2001 : c === "sau" ? 2005 : 1995, role: null as MemberRole,
  })),

  // IMF
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","rus","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "imf", countryId: c, joinYear: 1945, role: null as MemberRole,
  })),

  // World Bank
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","rus","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "worldbank", countryId: c, joinYear: 1945, role: null as MemberRole,
  })),

  // OECD — developed members from the Atlas subset
  ...[["usa",1961,"founding"],["can",1961,"founding"],["gbr",1961,"founding"],["fra",1961,"founding"],["deu",1961,"founding"],["esp",1961,"founding"],["ita",1962,null],["jpn",1964,null],["kor",1996,null],["aus",1971,null],["nzl",1973,null],["mex",1994,null]].map(([c,y,r]) => ({
    orgId: "oecd", countryId: c as string, joinYear: y as number, role: r as MemberRole,
  })),

  // G7
  ...[["usa",1975,"founding"],["gbr",1975,"founding"],["fra",1975,"founding"],["deu",1975,"founding"],["ita",1975,"founding"],["jpn",1975,"founding"],["can",1976,null]].map(([c,y,r]) => ({
    orgId: "g7", countryId: c as string, joinYear: y as number, role: r as MemberRole,
  })),

  // G20 — Atlas subset
  ...["usa","can","mex","bra","arg","gbr","fra","deu","ita","rus","zaf","chn","ind","jpn","kor","sau","idn","aus"].map((c) => ({
    orgId: "g20", countryId: c, joinYear: 1999, role: null as MemberRole,
  })),

  // BRICS — founding 4 + South Africa 2010
  { orgId: "brics", countryId: "bra", joinYear: 2009, role: "founding" },
  { orgId: "brics", countryId: "rus", joinYear: 2009, role: "founding" },
  { orgId: "brics", countryId: "ind", joinYear: 2009, role: "founding" },
  { orgId: "brics", countryId: "chn", joinYear: 2009, role: "founding" },
  { orgId: "brics", countryId: "zaf", joinYear: 2010, role: null },
  { orgId: "brics", countryId: "egy", joinYear: 2024, role: null },

  // Commonwealth of Nations — Atlas members
  ...[["gbr",1931,"founding"],["can",1931,"founding"],["aus",1931,"founding"],["nzl",1931,"founding"],["ind",1947,null],["zaf",1931,"founding"],["nga",1960,null],["ken",1963,null]].map(([c,y,r]) => ({
    orgId: "commonwealth", countryId: c as string, joinYear: y as number, role: r as MemberRole,
  })),

  // OIF — Atlas Francophone subset (observers + full)
  { orgId: "oif", countryId: "fra", joinYear: 1970, role: "founding" },
  { orgId: "oif", countryId: "can", joinYear: 1970, role: "founding" },
  { orgId: "oif", countryId: "egy", joinYear: 1983, role: null },
  { orgId: "oif", countryId: "ken", joinYear: 2016, role: "observer" },
  { orgId: "oif", countryId: "mex", joinYear: 2014, role: "observer" },
  { orgId: "oif", countryId: "arg", joinYear: 2016, role: "observer" },
  { orgId: "oif", countryId: "kor", joinYear: 2016, role: "observer" },
];

export function getOrganizationBySlug(slug: string): Organization | undefined {
  return ORGANIZATIONS.find((o) => o.slug === slug || o.id === slug);
}

export function getMembershipsForCountry(countryId: string): Membership[] {
  return MEMBERSHIPS.filter((m) => m.countryId === countryId);
}

export function getMembersOfOrg(orgId: string): Membership[] {
  return MEMBERSHIPS.filter((m) => m.orgId === orgId);
}

export function getMemberCount(orgId: string): number {
  return MEMBERSHIPS.filter((m) => m.orgId === orgId).length;
}

export function getCoMembers(countryId: string): Array<{ countryId: string; sharedCount: number }> {
  const myOrgs = new Set(MEMBERSHIPS.filter((m) => m.countryId === countryId).map((m) => m.orgId));
  const counts = new Map<string, number>();
  for (const m of MEMBERSHIPS) {
    if (m.countryId === countryId) continue;
    if (myOrgs.has(m.orgId)) {
      counts.set(m.countryId, (counts.get(m.countryId) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([countryId, sharedCount]) => ({ countryId, sharedCount }))
    .sort((a, b) => b.sharedCount - a.sharedCount);
}
