/**
 * Claim-level source lineage for reconciliation and provenance reporting.
 *
 * A database source ID is not automatically an independent evidence source.
 * Republishers collapse into the family that produced the underlying claim;
 * compilations and unknown lineage fail closed into one unverified family.
 */

export type SourceRelationship =
  | "originator"
  | "republisher"
  | "compilation"
  | "unverified";

export type SourceLineage = {
  sourceId: string;
  factKey: string;
  jurisdictionIso3?: string | null;
  familyId: string;
  relationship: SourceRelationship;
  independentEligible: boolean;
  basis: string;
};

const UN_WPP_FACTS = new Set([
  "population_total",
  "population_growth_rate",
  "birth_rate",
  "death_rate",
  "fertility_rate",
]);

const WORLD_BANK_UPSTREAM: Readonly<Record<string, string>> = {
  population_total: "un_wpp",
  population_growth_rate: "un_wpp",
  birth_rate: "un_wpp",
  death_rate: "un_wpp",
  fertility_rate: "un_wpp",
  life_expectancy_years: "un_health_demography",
  infant_mortality_per_1000: "un_child_mortality_interagency",
  literacy_rate: "unesco_uis",
  unemployment_rate_pct: "ilo_ilostat",
  internet_users_pct: "itu",
  military_expenditure_pct_gdp: "sipri",
  urbanization_rate: "un_wpp",
};

const UNDP_UPSTREAM: Readonly<Record<string, string>> = {
  expected_years_schooling: "unesco_uis",
  mean_years_schooling: "unesco_uis",
  life_expectancy_years: "un_health_demography",
};

const NSO_ISO3: Readonly<Record<string, string>> = {
  us_census: "USA",
  ons_uk: "GBR",
  insee_fr: "FRA",
  destatis_de: "DEU",
  statcan_ca: "CAN",
  ibge_br: "BRA",
  stats_sa: "ZAF",
  nbs_nigeria: "NGA",
};

const DIRECT_PUBLISHERS = new Set([
  "fao_faostat",
  "ilo_ilostat",
  "imf_weo",
  "oecd_stat",
  "unesco_uis",
  "who_gho",
  "wto_stats",
  "vdem",
]);

export function resolveSourceLineage(input: {
  sourceId: string;
  factKey: string;
  jurisdictionIso3?: string | null;
}): SourceLineage {
  const { sourceId, factKey, jurisdictionIso3 } = input;
  const identity = { sourceId, factKey };

  if (sourceId === "cia_factbook" || sourceId === "wikidata") {
    return {
      ...identity,
      familyId: "unverified_secondary_compilation",
      relationship: "compilation",
      independentEligible: false,
      basis: "Compilation rows do not identify a claim-level origin by default.",
    };
  }

  if (sourceId === "un_data") {
    const familyId = UN_WPP_FACTS.has(factKey)
      ? "un_wpp"
      : factKey === "life_expectancy_years"
        ? "un_health_demography"
        : factKey === "infant_mortality_per_1000"
          ? "un_child_mortality_interagency"
          : "un_statistics_division";
    return {
      ...identity,
      familyId,
      relationship: familyId === "un_statistics_division" ? "originator" : "republisher",
      independentEligible: true,
      basis: "UN Data is assigned to the named upstream statistical programme for this fact key.",
    };
  }

  if (sourceId === "world_bank") {
    const upstream = WORLD_BANK_UPSTREAM[factKey];
    return {
      ...identity,
      familyId: upstream ?? "world_bank",
      relationship: upstream ? "republisher" : "originator",
      independentEligible: true,
      basis: upstream
        ? "World Bank indicator metadata identifies another statistical publisher as the upstream family."
        : "World Bank is treated as the producing institution for this registered indicator.",
    };
  }

  if (sourceId === "undp_hdi") {
    const upstream = UNDP_UPSTREAM[factKey];
    return {
      ...identity,
      familyId: upstream ?? "undp_hdi",
      relationship: upstream ? "republisher" : "originator",
      independentEligible: true,
      basis: upstream
        ? "UNDP republishes the upstream education or demographic input for this fact key."
        : "UNDP produces this Human Development Report indicator.",
    };
  }

  const nsoIso3 = NSO_ISO3[sourceId];
  if (nsoIso3) {
    const inScope = jurisdictionIso3 === nsoIso3;
    return {
      ...identity,
      jurisdictionIso3,
      familyId: inScope ? `nso:${nsoIso3}` : "unverified_lineage",
      relationship: inScope ? "originator" : "unverified",
      independentEligible: inScope,
      basis: inScope
        ? "The registered national statistical office produces the country observation."
        : "A national statistical office is an originator only for its registered jurisdiction; missing or mismatched scope fails closed.",
    };
  }

  if (sourceId === "eurostat") {
    const familyId = jurisdictionIso3 === "FRA" ? "nso:FRA" : "eurostat";
    return {
      ...identity,
      jurisdictionIso3,
      familyId,
      relationship: jurisdictionIso3 === "FRA" ? "republisher" : "originator",
      independentEligible: true,
      basis:
        jurisdictionIso3 === "FRA"
          ? "For France, Eurostat republishes the INSEE observation and shares its family."
          : "Eurostat's harmonised series is treated as its own statistical family unless a registered claim-level NSO handoff applies.",
    };
  }

  if (DIRECT_PUBLISHERS.has(sourceId)) {
    const familyId =
      sourceId === "who_gho" && factKey === "life_expectancy_years"
        ? "un_health_demography"
        : sourceId;
    return {
      ...identity,
      familyId,
      relationship: "originator",
      independentEligible: true,
      basis: "Registered direct statistical publisher for this observation.",
    };
  }

  return {
    ...identity,
    familyId: "unverified_lineage",
    relationship: "unverified",
    independentEligible: false,
    basis: "No claim-level lineage rule is registered; independence fails closed.",
  };
}

export function countIndependentFamilies(
  rows: Array<{
    sourceId: string;
    factKey: string;
    jurisdictionIso3?: string | null;
    valueType?: "measured" | "projected" | string | null;
  }>,
): number {
  const measured = rows.filter((row) => row.valueType !== "projected");
  const eligible = new Set(
    measured
      .map(resolveSourceLineage)
      .filter((lineage) => lineage.independentEligible)
      .map((lineage) => lineage.familyId),
  );
  if (eligible.size > 0) return eligible.size;
  return measured.length > 0 ? 1 : 0;
}
