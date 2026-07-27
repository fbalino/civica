import type { Membership } from "@/lib/data/international-organizations";

export const ORGANIZATION_MEMBERSHIP_RELEASE_VERSION =
  "organization-membership-release/2026-07-v1" as const;
export const ORGANIZATION_MEMBERSHIP_SOURCE_ID =
  "civica_organization_roster_v1" as const;
export const ORGANIZATION_MEMBERSHIP_RETRIEVED_AT =
  "2026-07-12T00:00:00.000Z" as const;

export type OrganizationRosterCoverage = "complete" | "selected";

/** Stable DB slugs for the 23 identities in the checked release. */
export const ORGANIZATION_DATABASE_SLUGS: Readonly<Record<string, string>> = {
  un: "united-nations",
  unsc: "un-security-council",
  who: "who",
  unesco: "unesco",
  iaea: "iaea",
  nato: "nato",
  eu: "european-union",
  coe: "council-of-europe",
  asean: "asean",
  au: "african-union",
  arableague: "arab-league",
  oas: "oas",
  ecowas: "ecowas",
  gcc: "gcc",
  wto: "wto",
  imf: "imf",
  worldbank: "world-bank",
  oecd: "oecd",
  g7: "g7",
  g20: "g20",
  brics: "brics",
  commonwealth: "commonwealth",
  oif: "la-francophonie",
} as const;

export interface OrganizationMembershipSource {
  label: string;
  url: string;
  license: string;
  coverage: OrganizationRosterCoverage;
  dateCoverage: "day" | "year" | "unavailable";
}

const publisherTerms =
  "Publisher website terms; factual reference only; source content is not redistributed";

/**
 * Exact publisher pages used to check the hand-curated roster. `selected`
 * means Civica publishes only the rows it has checked; absence is never a
 * claim of non-membership. Dates are suppressed when the checked compilation
 * does not support them, even if an older seed supplied a founding-year
 * placeholder.
 */
export const ORGANIZATION_MEMBERSHIP_SOURCES: Readonly<
  Record<string, OrganizationMembershipSource>
> = {
  un: {
    label: "United Nations Member States",
    url: "https://www.un.org/en/about-us/member-states",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  unsc: {
    label: "United Nations Security Council membership",
    url: "https://www.un.org/securitycouncil/content/current-members",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  who: {
    label: "World Health Organization countries",
    url: "https://www.who.int/countries",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "unavailable",
  },
  unesco: {
    label: "UNESCO Member States and country profiles",
    url: "https://www.unesco.org/en/countries",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "unavailable",
  },
  iaea: {
    label: "IAEA Member States, INFCIRC/2/Rev.92",
    url: "https://www.iaea.org/sites/default/files/publications/documents/infcircs/1959/infcirc2r92.pdf",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "unavailable",
  },
  nato: {
    label: "NATO member countries",
    url: "https://www.nato.int/cps/en/natohq/topics_52044.htm",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  eu: {
    label: "European Union country profiles",
    url: "https://european-union.europa.eu/principles-countries-history/country-profiles_en",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  coe: {
    label: "Council of Europe member states",
    url: "https://www.coe.int/en/web/portal/46-members-states",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  asean: {
    label: "ASEAN Member States",
    url: "https://asean.org/member-states/",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  au: {
    label: "African Union Member States",
    url: "https://au.int/en/member_states/countryprofiles2",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  arableague: {
    label: "League of Arab States members",
    url: "https://www.lasportal.org/en/aboutlas/Pages/CountryData.aspx",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  oas: {
    label: "Organization of American States member states",
    url: "https://www.oas.org/en/member_states/default.asp",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  ecowas: {
    label: "ECOWAS Member States and withdrawal record",
    url: "https://www.ecowas.int/member-states/",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  gcc: {
    label: "Gulf Cooperation Council Member States",
    url: "https://www.gcc-sg.org/en/AboutUs/MemberStates/Pages/default.aspx",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  wto: {
    label: "World Trade Organization members and observers",
    url: "https://www.wto.org/english/thewto_e/whatis_e/tif_e/org6_e.htm",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  imf: {
    label: "International Monetary Fund member selection",
    url: "https://www.imf.org/external/np/fin/tad/query.aspx",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "unavailable",
  },
  worldbank: {
    label: "World Bank member countries",
    url: "https://www.worldbank.org/en/about/leadership/members",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "unavailable",
  },
  oecd: {
    label: "OECD members and partners",
    url: "https://www.oecd.org/en/about/members-partners.html",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  g7: {
    label: "Group of Seven members",
    url: "https://g7.canada.ca/en/g7-presidency/members/",
    license: publisherTerms,
    coverage: "complete",
    dateCoverage: "year",
  },
  g20: {
    label: "Group of Twenty members",
    url: "https://www.g20.org/en/about-the-g20/members",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  brics: {
    label: "BRICS members",
    url: "https://brics.br/en/about-the-brics",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  commonwealth: {
    label: "Commonwealth member countries",
    url: "https://thecommonwealth.org/our-member-countries",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
  oif: {
    label: "Organisation internationale de la Francophonie members",
    url: "https://www.francophonie.org/88-etats-et-gouvernements-125",
    license: publisherTerms,
    coverage: "selected",
    dateCoverage: "year",
  },
} as const;

export interface ReleasedOrganizationMembership {
  status: "current" | "withdrawn";
  joinYear: number | null;
  joinDatePrecision: "year" | "unknown";
  endYear: number | null;
  endDatePrecision: "year" | "unknown";
  source: OrganizationMembershipSource;
  sourceId: typeof ORGANIZATION_MEMBERSHIP_SOURCE_ID;
  retrievedAt: typeof ORGANIZATION_MEMBERSHIP_RETRIEVED_AT;
  upstreamVintage: typeof ORGANIZATION_MEMBERSHIP_RELEASE_VERSION;
}

export function releaseOrganizationMembership(
  membership: Membership,
): ReleasedOrganizationMembership {
  const source = ORGANIZATION_MEMBERSHIP_SOURCES[membership.orgId];
  if (!source) {
    throw new Error(
      `No organization membership source for ${membership.orgId}`,
    );
  }
  const supportsYear = source.dateCoverage === "year";
  return {
    status: membership.status === "withdrawn" ? "withdrawn" : "current",
    joinYear: supportsYear ? membership.joinYear : null,
    joinDatePrecision: supportsYear ? "year" : "unknown",
    endYear: membership.endYear ?? null,
    endDatePrecision: membership.endYear == null ? "unknown" : "year",
    source,
    sourceId: ORGANIZATION_MEMBERSHIP_SOURCE_ID,
    retrievedAt: ORGANIZATION_MEMBERSHIP_RETRIEVED_AT,
    upstreamVintage: ORGANIZATION_MEMBERSHIP_RELEASE_VERSION,
  };
}
