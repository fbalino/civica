export const JURISDICTION_STATUS_VERSION = "jurisdiction-status/v1" as const;
export const JURISDICTION_STATUS_REVIEWED_AT = "2026-07-10" as const;

export const JURISDICTION_STATUS_TYPES = [
  "sovereign_state",
  "associated_state",
  "dependency_or_territory",
  "disputed_or_limited_recognition",
  "aggregate_or_special_area",
] as const;

export type JurisdictionStatusType = (typeof JURISDICTION_STATUS_TYPES)[number];

export const JURISDICTION_STATUS_DISPLAY_POLICY: Record<
  JurisdictionStatusType,
  {
    shortLabel: string;
    includeInSovereignStateCounts: boolean;
    publicRule: string;
  }
> = {
  sovereign_state: {
    shortLabel: "Sovereign state",
    includeInSovereignStateCounts: true,
    publicRule:
      "May appear in sovereign-state country totals and research universes when the measure otherwise covers it.",
  },
  associated_state: {
    shortLabel: "Associated state",
    includeInSovereignStateCounts: false,
    publicRule:
      "Display the free-association relationship; do not relabel as either a sovereign UN member or an ordinary dependency.",
  },
  dependency_or_territory: {
    shortLabel: "Dependency or territory",
    includeInSovereignStateCounts: false,
    publicRule:
      "Display the administering relationship and any dispute note; exclude from sovereign-state totals.",
  },
  disputed_or_limited_recognition: {
    shortLabel: "Disputed or limited-recognition entity",
    includeInSovereignStateCounts: false,
    publicRule:
      "Use the record-specific neutral label and source note; never imply that Atlas inclusion settles recognition or sovereignty.",
  },
  aggregate_or_special_area: {
    shortLabel: "Aggregate or special area",
    includeInSovereignStateCounts: false,
    publicRule:
      "Identify grouped or treaty-area scope explicitly and exclude it from country and sovereign-state totals.",
  },
};

export const JURISDICTION_STATUS_SOURCES = {
  un_member_states: {
    label: "United Nations Member States",
    url: "https://www.un.org/en/about-us/member-states",
    role: "Closed membership list; membership is recorded directly and is not inferred from ISO coding.",
  },
  un_non_member_states: {
    label: "United Nations Non-Member States",
    url: "https://www.un.org/en/about-us/non-member-states",
    role: "Records the Holy See and State of Palestine as General Assembly observer states.",
  },
  un_m49: {
    label: "UN Statistics M49 countries or areas",
    url: "https://unstats.un.org/unsd/methodology/m49/",
    role: "Identity and statistical-area reference only; M49 inclusion is not treated as a sovereignty judgment.",
  },
  cia_factbook: {
    label: "CIA World Factbook country and area profiles",
    url: "https://www.cia.gov/the-world-factbook/",
    role: "Dependency, administering-state, special-area, and territorial-status descriptions in the frozen January 2026 Atlas source.",
  },
  nz_mfat_cook_islands: {
    label: "New Zealand MFAT — Cook Islands",
    url: "https://www.mfat.govt.nz/en/countries-and-regions/australia-and-pacific/cook-islands",
    role: "Primary-government description of the Cook Islands as self-governing in free association with New Zealand.",
  },
  nz_mfat_niue: {
    label: "New Zealand MFAT — Niue",
    url: "https://www.mfat.govt.nz/en/countries-and-regions/australia-and-pacific/niue",
    role: "Primary-government description of Niue as self-governing in free association with New Zealand.",
  },
} as const;

export type JurisdictionStatusSourceId =
  keyof typeof JURISDICTION_STATUS_SOURCES;

// Exact ISO3 membership inventory from the UN's current 193-member list.
// Keeping the set closed prevents a newly ingested ISO code from silently
// becoming a sovereign state.
export const UN_MEMBER_ISO3 = new Set(
  "AFG AGO ALB AND ARE ARG ARM ATG AUS AUT AZE BDI BEL BEN BFA BGD BGR BHR BHS BIH BLR BLZ BOL BRA BRB BRN BTN BWA CAF CAN CHE CHL CHN CIV CMR COD COG COL COM CPV CRI CUB CYP CZE DEU DJI DMA DNK DOM DZA ECU EGY ERI ESP EST ETH FIN FJI FRA FSM GAB GBR GEO GHA GIN GMB GNB GNQ GRC GRD GTM GUY HND HRV HTI HUN IDN IND IRL IRN IRQ ISL ISR ITA JAM JOR JPN KAZ KEN KGZ KHM KIR KNA KOR KWT LAO LBN LBR LBY LCA LIE LKA LSO LTU LUX LVA MAR MCO MDA MDG MDV MEX MHL MKD MLI MLT MMR MNE MNG MOZ MRT MUS MWI MYS NAM NER NGA NIC NLD NOR NPL NRU NZL OMN PAK PAN PER PHL PLW PNG POL PRK PRT PRY QAT ROU RUS RWA SAU SDN SEN SGP SLB SLE SLV SMR SOM SRB SSD STP SUR SVK SVN SWE SWZ SYC SYR TCD TGO THA TJK TKM TLS TON TTO TUN TUR TUV TZA UGA UKR URY USA UZB VCT VEN VNM VUT WSM YEM ZAF ZMB ZWE".split(
    " ",
  ),
);

const DEPENDENCIES_BY_ADMINISTERING_ISO3 = {
  AUS: [
    "ashmore-and-cartier-islands",
    "christmas-island",
    "cocos-keeling-islands",
    "coral-sea-islands",
    "heard-island-and-mcdonald-islands",
    "norfolk-island",
  ],
  CHN: ["hong-kong", "macau"],
  DNK: ["faroe-islands", "greenland"],
  FRA: [
    "clipperton-island",
    "french-polynesia",
    "french-southern-and-antarctic-lands",
    "new-caledonia",
    "saint-barthelemy",
    "saint-martin",
    "saint-pierre-and-miquelon",
    "wallis-and-futuna",
  ],
  GBR: [
    "akrotiri",
    "anguilla",
    "bermuda",
    "british-virgin-islands",
    "cayman-islands",
    "dhekelia",
    "falkland-islands-islas-malvinas",
    "gibraltar",
    "guernsey",
    "isle-of-man",
    "jersey",
    "montserrat",
    "pitcairn-islands",
    "south-georgia-and-south-sandwich-islands",
    "turks-and-caicos-islands",
  ],
  NLD: ["aruba", "curacao", "sint-maarten"],
  NOR: [
    "bouvet-island",
    "jan-mayen",
    "svalbard-sometimes-referred-to-as-spitsbergen-the-largest-island-in-the-archipelago",
  ],
  NZL: ["tokelau"],
  USA: [
    "american-samoa",
    "guam",
    "navassa-island",
    "northern-mariana-islands",
    "puerto-rico",
    "virgin-islands",
    "wake-island",
  ],
} as const;

const ASSOCIATED_STATE_SLUGS = new Set(["cook-islands", "niue"]);
const DISPUTED_AREA_SLUGS = new Set([
  "gaza-gaza-strip",
  "paracel-islands",
  "spratly-islands",
  "west-bank",
  "western-sahara",
]);
const SPECIAL_AREA_SLUGS = new Set(["antarctica"]);
const AGGREGATE_AREA_SLUGS = new Set([
  "baker-island-howland-island-jarvis-island-johnston-atoll-kingman-reef-midway-islands-palmyra-atoll",
]);
const LIMITED_RECOGNITION_ISO3 = new Set(["PSE", "TWN", "XKS"]);
const DISPUTED_DEPENDENCY_SLUGS = new Set([
  "falkland-islands-islas-malvinas",
  "navassa-island",
  "south-georgia-and-south-sandwich-islands",
]);

const dependencyParentBySlug = new Map<string, string>();
for (const [parentIso3, slugs] of Object.entries(
  DEPENDENCIES_BY_ADMINISTERING_ISO3,
)) {
  for (const slug of slugs) dependencyParentBySlug.set(slug, parentIso3);
}

export type JurisdictionStatusRecord = {
  type: JurisdictionStatusType;
  displayLabel: string;
  sourceIds: JurisdictionStatusSourceId[];
  reviewedAt: typeof JURISDICTION_STATUS_REVIEWED_AT;
  administeringJurisdictionIso3: string | null;
  disputed: boolean;
  note: string;
};

export function classifyJurisdictionStatus(input: {
  slug: string;
  iso3: string | null | undefined;
  dependencyStatus?: string | null;
}): JurisdictionStatusRecord {
  const iso3 = input.iso3?.toUpperCase() ?? null;
  const base = { reviewedAt: JURISDICTION_STATUS_REVIEWED_AT } as const;

  if (iso3 && UN_MEMBER_ISO3.has(iso3)) {
    return {
      ...base,
      type: "sovereign_state",
      displayLabel: "UN member state",
      sourceIds: ["un_member_states", "un_m49"],
      administeringJurisdictionIso3: null,
      disputed: false,
      note: "Listed by Civica as a sovereign state because it is in the closed UN member-state inventory.",
    };
  }

  if (iso3 === "VAT") {
    return {
      ...base,
      type: "sovereign_state",
      displayLabel: "Sovereign observer state",
      sourceIds: ["un_non_member_states", "un_m49", "cia_factbook"],
      administeringJurisdictionIso3: null,
      disputed: false,
      note: "The Holy See is a UN non-member observer state; Civica does not relabel every observer or M49 area as sovereign.",
    };
  }

  if (iso3 && LIMITED_RECOGNITION_ISO3.has(iso3)) {
    return {
      ...base,
      type: "disputed_or_limited_recognition",
      displayLabel:
        iso3 === "PSE" ? "UN observer state" : "Limited-recognition entity",
      sourceIds:
        iso3 === "PSE"
          ? ["un_non_member_states", "un_m49", "cia_factbook"]
          : ["cia_factbook", "un_m49"],
      administeringJurisdictionIso3: null,
      disputed: true,
      note: "Civica profiles this entity separately while avoiding a claim that statistical coding or Atlas inclusion settles recognition or sovereignty.",
    };
  }

  if (ASSOCIATED_STATE_SLUGS.has(input.slug)) {
    const cook = input.slug === "cook-islands";
    return {
      ...base,
      type: "associated_state",
      displayLabel: "Self-governing state in free association",
      sourceIds: [
        cook ? "nz_mfat_cook_islands" : "nz_mfat_niue",
        "cia_factbook",
        "un_m49",
      ],
      administeringJurisdictionIso3: "NZL",
      disputed: false,
      note:
        input.dependencyStatus ??
        "Self-governing in free association with New Zealand; not collapsed into either the sovereign-state or dependency category.",
    };
  }

  const parentIso3 = dependencyParentBySlug.get(input.slug);
  if (parentIso3) {
    return {
      ...base,
      type: "dependency_or_territory",
      displayLabel: "Dependency or territory",
      sourceIds: ["cia_factbook", "un_m49"],
      administeringJurisdictionIso3: parentIso3,
      disputed: DISPUTED_DEPENDENCY_SLUGS.has(input.slug),
      note:
        input.dependencyStatus ??
        "Separately profiled dependency or territory; the administering relationship is descriptive and does not resolve a competing claim.",
    };
  }

  if (DISPUTED_AREA_SLUGS.has(input.slug)) {
    return {
      ...base,
      type: "disputed_or_limited_recognition",
      displayLabel: "Disputed or separately profiled area",
      sourceIds: ["cia_factbook", "un_m49"],
      administeringJurisdictionIso3: null,
      disputed: true,
      note: "Separately profiled area with disputed or unresolved status; Civica's label is not a sovereignty determination.",
    };
  }

  if (SPECIAL_AREA_SLUGS.has(input.slug)) {
    return {
      ...base,
      type: "aggregate_or_special_area",
      displayLabel: "Special treaty area",
      sourceIds: ["cia_factbook", "un_m49"],
      administeringJurisdictionIso3: null,
      disputed: false,
      note: "Special geographic area retained as an Atlas reference entry, not counted as a sovereign state.",
    };
  }

  if (AGGREGATE_AREA_SLUGS.has(input.slug)) {
    return {
      ...base,
      type: "aggregate_or_special_area",
      displayLabel: "Grouped territorial entry",
      sourceIds: ["cia_factbook", "un_m49"],
      administeringJurisdictionIso3: "USA",
      disputed: false,
      note:
        input.dependencyStatus ??
        "One Atlas row groups several United States island areas and must not be counted as one sovereign state.",
    };
  }

  throw new Error(
    `No ${JURISDICTION_STATUS_VERSION} classification for ${input.slug} (${iso3 ?? "no ISO3"})`,
  );
}

export function getJurisdictionStatusCatalogSummary() {
  return {
    unMemberStates: UN_MEMBER_ISO3.size,
    sovereignObserverStates: 1,
    limitedRecognitionIso3: LIMITED_RECOGNITION_ISO3.size,
    associatedStates: ASSOCIATED_STATE_SLUGS.size,
    dependenciesOrTerritories: dependencyParentBySlug.size,
    disputedAreas: DISPUTED_AREA_SLUGS.size,
    specialAreas: SPECIAL_AREA_SLUGS.size,
    aggregateAreas: AGGREGATE_AREA_SLUGS.size,
    total:
      UN_MEMBER_ISO3.size +
      1 +
      LIMITED_RECOGNITION_ISO3.size +
      ASSOCIATED_STATE_SLUGS.size +
      dependencyParentBySlug.size +
      DISPUTED_AREA_SLUGS.size +
      SPECIAL_AREA_SLUGS.size +
      AGGREGATE_AREA_SLUGS.size,
  };
}
