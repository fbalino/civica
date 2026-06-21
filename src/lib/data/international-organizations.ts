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
  memberCount?: number;
  description?: string;
  extra?: Record<string, string | number>;
}

export interface Membership {
  orgId: string;
  countryId: string;
  joinYear: number;
  role?: MemberRole;
}

export interface OrganizationMemberCountryFallback {
  id: string;
  name: string;
  slug: string;
  region: string;
}

const ORG_MEMBER_COUNTRY_FALLBACKS: Record<
  string,
  OrganizationMemberCountryFallback
> = {
  are: {
    id: "are",
    name: "United Arab Emirates",
    slug: "united-arab-emirates",
    region: "Asia",
  },
  caf: {
    id: "caf",
    name: "Central African Republic",
    slug: "central-african-republic",
    region: "Africa",
  },
  esh: {
    id: "esh",
    name: "Western Sahara",
    slug: "western-sahara",
    region: "Africa",
  },
  pse: {
    id: "pse",
    name: "Palestine",
    slug: "palestine",
    region: "Asia",
  },
};

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  security: "Security & Defense",
  regional: "Regional Blocs",
  trade: "Trade & Finance",
  un: "UN System",
  cultural: "Cultural & Language",
};

export const ORG_TYPE_COLOR: Record<OrgType, string> = {
  security: "var(--cat-security)",
  regional: "var(--cat-regional)",
  trade: "var(--cat-trade)",
  un: "var(--cat-un)",
  cultural: "var(--cat-cultural)",
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
    memberCount: 193,
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
    memberCount: 15,
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
    memberCount: 194,
  },
  {
    id: "unesco",
    slug: "unesco",
    name: "UNESCO",
    fullName: "UN Educational, Scientific and Cultural Organization",
    type: "un",
    foundedYear: 1945,
    hqCountry: "fra",
    memberCount: 194,
  },
  {
    id: "iaea",
    slug: "iaea",
    name: "IAEA",
    fullName: "International Atomic Energy Agency",
    type: "un",
    foundedYear: 1957,
    hqCountry: "aut",
    memberCount: 178,
    description: "UN-affiliated agency promoting peaceful use of nuclear energy and inhibiting its weaponization.",
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
    memberCount: 32,
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
    memberCount: 27,
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
    memberCount: 46,
  },
  {
    id: "asean",
    slug: "asean",
    name: "ASEAN",
    fullName: "Association of Southeast Asian Nations",
    type: "regional",
    foundedYear: 1967,
    hqCountry: "idn",
    memberCount: 10,
  },
  {
    id: "au",
    slug: "au",
    name: "AU",
    fullName: "African Union",
    type: "regional",
    foundedYear: 2002,
    hqCountry: "eth",
    memberCount: 55,
  },
  {
    id: "arableague",
    slug: "arab-league",
    name: "Arab League",
    fullName: "League of Arab States",
    type: "regional",
    foundedYear: 1945,
    hqCountry: "egy",
    memberCount: 22,
  },
  {
    id: "oas",
    slug: "oas",
    name: "OAS",
    fullName: "Organization of American States",
    type: "regional",
    foundedYear: 1948,
    hqCountry: "usa",
    memberCount: 35,
  },
  {
    id: "ecowas",
    slug: "ecowas",
    name: "ECOWAS",
    fullName: "Economic Community of West African States",
    type: "regional",
    foundedYear: 1975,
    hqCountry: "nga",
    memberCount: 15,
    description: "Regional economic and political bloc of West African states.",
  },
  {
    id: "gcc",
    slug: "gcc",
    name: "GCC",
    fullName: "Gulf Cooperation Council",
    type: "regional",
    foundedYear: 1981,
    hqCountry: "sau",
    memberCount: 6,
    description: "Regional union of Arab states bordering the Persian Gulf.",
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
    memberCount: 166,
  },
  {
    id: "imf",
    slug: "imf",
    name: "IMF",
    fullName: "International Monetary Fund",
    type: "trade",
    foundedYear: 1944,
    hqCountry: "usa",
    memberCount: 191,
  },
  {
    id: "worldbank",
    slug: "world-bank",
    name: "World Bank",
    fullName: "World Bank Group",
    type: "trade",
    foundedYear: 1944,
    hqCountry: "usa",
    memberCount: 189,
  },
  {
    id: "oecd",
    slug: "oecd",
    name: "OECD",
    fullName: "Organisation for Economic Co-operation and Development",
    type: "trade",
    foundedYear: 1961,
    hqCountry: "fra",
    memberCount: 38,
  },
  {
    id: "g7",
    slug: "g7",
    name: "G7",
    fullName: "Group of Seven",
    type: "trade",
    foundedYear: 1975,
    memberCount: 7,
  },
  {
    id: "g20",
    slug: "g20",
    name: "G20",
    fullName: "Group of Twenty",
    type: "trade",
    foundedYear: 1999,
    memberCount: 21,
  },
  {
    id: "brics",
    slug: "brics",
    name: "BRICS",
    fullName: "Brazil, Russia, India, China, South Africa",
    type: "trade",
    foundedYear: 2009,
    memberCount: 10,
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
    memberCount: 56,
  },
  {
    id: "oif",
    slug: "oif",
    name: "OIF",
    fullName: "Organisation internationale de la Francophonie",
    type: "cultural",
    foundedYear: 1970,
    hqCountry: "fra",
    memberCount: 88,
  },
];

const DEFAULT_JOIN_YEAR = 1945;

function orgMembers(
  orgId: string,
  countryIds: string[],
  joinYear = DEFAULT_JOIN_YEAR,
  role: MemberRole = null,
): Membership[] {
  return countryIds.map((countryId) => ({
    orgId,
    countryId,
    joinYear,
    role,
  }));
}

function orgMemberEntries(
  orgId: string,
  entries: Array<[countryId: string, joinYear?: number, role?: MemberRole]>,
): Membership[] {
  return entries.map(([countryId, joinYear = DEFAULT_JOIN_YEAR, role = null]) => ({
    orgId,
    countryId,
    joinYear,
    role,
  }));
}

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

  // EU — official 27 members.
  ...orgMemberEntries("eu", [
    ["bel", 1958, "founding"], ["fra", 1958, "founding"], ["deu", 1958, "founding"],
    ["ita", 1958, "founding"], ["lux", 1958, "founding"], ["nld", 1958, "founding"],
    ["dnk", 1973], ["irl", 1973], ["grc", 1981], ["prt", 1986], ["esp", 1986],
    ["aut", 1995], ["fin", 1995], ["swe", 1995], ["cyp", 2004], ["cze", 2004],
    ["est", 2004], ["hun", 2004], ["lva", 2004], ["ltu", 2004], ["mlt", 2004],
    ["pol", 2004], ["svk", 2004], ["svn", 2004], ["bgr", 2007], ["rou", 2007],
    ["hrv", 2013],
  ]),

  // Council of Europe — 46 current members.
  ...orgMemberEntries("coe", [
    ["bel", 1949, "founding"], ["dnk", 1949, "founding"], ["fra", 1949, "founding"],
    ["gbr", 1949, "founding"], ["irl", 1949, "founding"], ["ita", 1949, "founding"],
    ["lux", 1949, "founding"], ["nld", 1949, "founding"], ["nor", 1949, "founding"],
    ["swe", 1949, "founding"], ["grc", 1949], ["isl", 1950], ["tur", 1950],
    ["deu", 1950], ["aut", 1956], ["cyp", 1961], ["che", 1963], ["mlt", 1965],
    ["prt", 1976], ["esp", 1977], ["lie", 1978], ["smr", 1988], ["fin", 1989],
    ["hun", 1990], ["pol", 1991], ["bgr", 1992], ["est", 1993], ["ltu", 1993],
    ["svn", 1993], ["cze", 1993], ["svk", 1993], ["rou", 1993], ["and", 1994],
    ["lva", 1995], ["alb", 1995], ["mda", 1995], ["mkd", 1995], ["ukr", 1995],
    ["hrv", 1996], ["geo", 1999], ["arm", 2001], ["aze", 2001], ["bih", 2002],
    ["srb", 2003], ["mco", 2004], ["mne", 2007],
  ]),

  // ASEAN — official 10 members.
  ...orgMemberEntries("asean", [
    ["idn", 1967, "founding"], ["mys", 1967, "founding"], ["phl", 1967, "founding"],
    ["sgp", 1967, "founding"], ["tha", 1967, "founding"], ["brn", 1984],
    ["vnm", 1995], ["lao", 1997], ["mmr", 1997], ["khm", 1999],
  ]),

  // AU — current African Union members represented in Civica's atlas data.
  ...orgMembers("au", [
    "dza","ago","ben","bwa","bfa","bdi","cpv","cmr","caf","tcd","com","cog","civ",
    "cod","dji","egy","gnq","eri","swz","eth","gab","gmb","gha","gin","gnb",
    "ken","lso","lbr","lby","mdg","mwi","mli","mrt","mus","mar","moz","nam",
    "ner","nga","rwa","stp","sen","syc","sle","som","zaf","ssd","sdn","tza",
    "tgo","tun","uga","esh","zmb","zwe",
  ], 2002),

  // Arab League — 22 members; Atlas highlights/listing covers members present in the country dataset.
  ...orgMemberEntries("arableague", [
    ["egy", 1945, "founding"], ["irq", 1945, "founding"], ["jor", 1945, "founding"],
    ["lbn", 1945, "founding"], ["sau", 1945, "founding"], ["syr", 1945, "founding"],
    ["yem", 1945, "founding"], ["lby", 1953], ["sdn", 1956], ["mar", 1958],
    ["tun", 1958], ["kwt", 1961], ["dza", 1962], ["bhr", 1971], ["omn", 1971],
    ["qat", 1971], ["are", 1971], ["mrt", 1973], ["som", 1974], ["pse", 1976],
    ["dji", 1977], ["com", 1993],
  ]),

  // OAS — 35 member states in the Americas.
  ...orgMemberEntries("oas", [
    ["arg", 1948, "founding"], ["bol", 1948, "founding"], ["bra", 1948, "founding"],
    ["chl", 1948, "founding"], ["col", 1948, "founding"], ["cri", 1948, "founding"],
    ["cub", 1948, "founding"], ["dom", 1948, "founding"], ["ecu", 1948, "founding"],
    ["slv", 1948, "founding"], ["gtm", 1948, "founding"], ["hti", 1948, "founding"],
    ["hnd", 1948, "founding"], ["mex", 1948, "founding"], ["nic", 1948, "founding"],
    ["pan", 1948, "founding"], ["pry", 1948, "founding"], ["per", 1948, "founding"],
    ["usa", 1948, "founding"], ["ury", 1948, "founding"], ["ven", 1948, "founding"],
    ["brb", 1967], ["tto", 1967], ["jam", 1969], ["grd", 1975], ["sur", 1977],
    ["dma", 1979], ["lca", 1979], ["atg", 1981], ["vct", 1981], ["bhs", 1982],
    ["kna", 1984], ["can", 1990], ["blz", 1991], ["guy", 1991],
  ]),

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

  // IAEA — 178 members; Atlas subset mirrors the WHO/UNESCO highlight pattern.
  ...["usa","can","mex","bra","arg","gbr","fra","deu","esp","ita","rus","egy","nga","zaf","ken","chn","ind","jpn","kor","sau","idn","aus","nzl"].map((c) => ({
    orgId: "iaea", countryId: c, joinYear: 1957, role: null as MemberRole,
  })),

  // GCC — 6 founding members.
  ...orgMemberEntries("gcc", [
    ["sau", 1981, "founding"], ["kwt", 1981, "founding"], ["are", 1981, "founding"],
    ["qat", 1981, "founding"], ["bhr", 1981, "founding"], ["omn", 1981, "founding"],
  ]),

  // ECOWAS — 15 West African states. Note: Burkina Faso, Mali, and Niger
  // announced withdrawal in 2024; retained here as historical members.
  ...orgMemberEntries("ecowas", [
    ["nga", 1975, "founding"], ["civ", 1975, "founding"], ["sen", 1975, "founding"],
    ["gha", 1975, "founding"], ["mli", 1975, "founding"], ["bfa", 1975, "founding"],
    ["ner", 1975, "founding"], ["ben", 1975, "founding"], ["tgo", 1975, "founding"],
    ["gin", 1975, "founding"], ["sle", 1975, "founding"], ["lbr", 1975, "founding"],
    ["gmb", 1975, "founding"], ["gnb", 1977], ["cpv", 1976],
  ]),

  // OIF — Atlas Francophone subset (observers + full)
  { orgId: "oif", countryId: "fra", joinYear: 1970, role: "founding" },
  { orgId: "oif", countryId: "can", joinYear: 1970, role: "founding" },
  { orgId: "oif", countryId: "egy", joinYear: 1983, role: null },
  { orgId: "oif", countryId: "ken", joinYear: 2016, role: "observer" },
  { orgId: "oif", countryId: "mex", joinYear: 2014, role: "observer" },
  { orgId: "oif", countryId: "arg", joinYear: 2016, role: "observer" },
  { orgId: "oif", countryId: "kor", joinYear: 2016, role: "observer" },
];

const ORG_SLUG_ALIASES: Record<string, string> = {
  "european-union": "eu",
  "council-of-europe": "coe",
  "african-union": "au",
  "united-nations": "un",
  "un-security-council": "unsc",
  "la-francophonie": "oif",
};

export function getOrganizationBySlug(slug: string): Organization | undefined {
  const canonical = ORG_SLUG_ALIASES[slug] ?? slug;
  return ORGANIZATIONS.find((o) => o.slug === canonical || o.id === canonical);
}

export function getMembershipsForCountry(countryId: string): Membership[] {
  return MEMBERSHIPS.filter((m) => m.countryId === countryId);
}

export function getMembersOfOrg(orgId: string): Membership[] {
  return MEMBERSHIPS.filter((m) => m.orgId === orgId);
}

export function getOrgMemberCountryFallback(
  countryId: string,
): OrganizationMemberCountryFallback | null {
  return ORG_MEMBER_COUNTRY_FALLBACKS[countryId] ?? null;
}

export function getMemberCount(orgId: string): number {
  return (
    ORGANIZATIONS.find((o) => o.id === orgId)?.memberCount ??
    MEMBERSHIPS.filter((m) => m.orgId === orgId).length
  );
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
