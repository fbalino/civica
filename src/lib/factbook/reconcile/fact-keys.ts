/**
 * Phase F — canonical Civica fact-key enumeration.
 *
 * Each entry assigns a (group, category) pair plus the plausibility +
 * material-error guards the resolver consults. The full list of keys
 * mirrors methodology §1.1 (in-scope fact categories) and is the single
 * source of truth referenced by:
 *
 *   - `src/lib/db/schema.ts` :: `countryFacts.factGroup` / `factKey`
 *   - sync scripts (`scripts/sync-factbook-{cia,wikidata,worldbank,imf,un}.ts`)
 *   - the resolver in `src/lib/factbook/reconcile/resolver.ts`
 *   - the alternate-values panel
 *   - the public API provenance block
 *
 * Methodology references:
 *   §1.1   in-scope fact categories (Group A / B / C)
 *   §3.3   Guard 1 — material-error rejection (counts 50%, USD 80%, pp 50)
 *   §3.6   plausibility envelopes (population, GDP/capita, percentages, years)
 *   §13.10 explicit non-additions (no confidence column, no LLM)
 *
 * Existing CIA-seeded fact_keys (37 distinct as of 2026-05-02) are
 * mapped 1:1 into this enum so the resolver can pick them up without
 * a backfill pass. New Phase F keys (Wikidata / World Bank / IMF / UN
 * adapters) are added in the same enum and tagged with the same
 * (group, category) pair so the resolver treats them uniformly.
 *
 * Adding a new fact-key:
 *   1. Choose a group per methodology §1.1 — when uncertain, default
 *      to Group B (safe bucket; material-error guards apply).
 *   2. Choose a category from `FactCategory`.
 *   3. Add an envelope ONLY for numeric facts; leave undefined for
 *      strings / breakdowns.
 *   4. Add a label (short, sentence-case, no trailing period).
 *   5. If the fact has a "higher is worse" semantics (inflation,
 *      infant mortality, public debt), set `higherIsBetter: false`.
 *      For most facts this stays undefined.
 */

export type FactGroup = "A" | "B" | "C";

export type FactCategory =
  | "identity"
  | "demographics"
  | "economy"
  | "geography"
  | "society"
  | "communications"
  | "energy"
  | "environment"
  | "government"
  | "military"
  | "transport";

export interface PlausibilityEnvelope {
  /** For numeric facts: minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** True when the value is a percentage (envelope auto-tightens to
   *  `[-1, 101]`). Per methodology §3.6 / §3.3 percentage guard. */
  isPercent?: boolean;
  /** True when the value is a calendar year. Auto-envelope `[1500, 2100]`. */
  isYear?: boolean;
}

export interface FactKeyDefinition {
  key: string;
  /** Alias for `key` so callers that already match on `factKey`
   *  (e.g. the existing resolver scaffold) compile against this
   *  registry without a rename pass. Always equals `key` for entries
   *  built via `getFactKey()` / `FACT_KEYS`. Optional in the type so
   *  test fixtures may construct ad-hoc definitions without it. */
  factKey?: string;
  /** Group A | B | C per methodology §1.1. */
  group: FactGroup;
  category: FactCategory;
  /** Human-readable display label, sentence-case, no trailing period. */
  label: string;
  /** Unit string for numeric facts, e.g. "USD", "%", "people", "km2". */
  unit?: string;
  /** Plausibility envelope per methodology §3.6 (sync-time outlier filter). */
  envelope?: PlausibilityEnvelope;
  /** Ranking direction for leaderboards; undefined when no preferred
   *  direction (e.g. population, area). */
  higherIsBetter?: boolean;
  /** Methodology §3.3 Guard 1 — material-error fractional threshold for
   *  numeric, non-percentage facts. 0.5 = 50%, 0.8 = 80%. Defaults
   *  documented inline:
   *    counts (population, electricity kWh, refugee count): 0.5
   *    USD figures (GDP, exports, reserves):                 0.8
   *  Percentages use `materialErrorPpThreshold` instead. */
  materialErrorPctThreshold?: number;
  /** Methodology §3.3 Guard 1 — percentage-point delta threshold for
   *  facts where `isPercent: true`. 50 = 50pp swing in one year is
   *  rejected as material error. */
  materialErrorPpThreshold?: number;
}

// Group definitions below omit the `factKey` alias for brevity; the
// registry builder populates it from `key`.
type FactKeyInput = Omit<FactKeyDefinition, "factKey">;

// ─────────────────────────────────────────────────────────────────────
// GROUP A — slow-changing identity facts (~25 keys).
// Default policy: CIA wins; Wikidata override requires data_disputes
// row + reviewer signoff (methodology §3.4).
// ─────────────────────────────────────────────────────────────────────

const GROUP_A: FactKeyInput[] = [
  { key: "capital", group: "A", category: "identity", label: "Capital" },
  {
    key: "official_name_long",
    group: "A",
    category: "identity",
    label: "Official long-form name",
  },
  {
    key: "official_name_short",
    group: "A",
    category: "identity",
    label: "Official short-form name",
  },
  { key: "iso2", group: "A", category: "identity", label: "ISO 3166-1 alpha-2" },
  { key: "iso3", group: "A", category: "identity", label: "ISO 3166-1 alpha-3" },
  { key: "wikidata_qid", group: "A", category: "identity", label: "Wikidata QID" },
  {
    key: "currency_code",
    group: "A",
    category: "identity",
    label: "Currency code (ISO 4217)",
  },
  { key: "currency_name", group: "A", category: "identity", label: "Currency name" },
  {
    key: "official_languages",
    group: "A",
    category: "society",
    label: "Official languages",
  },
  // Areas: km² envelope spans Vatican (0.49) up to Russia (~17.1M).
  {
    key: "area_total_km2",
    group: "A",
    category: "geography",
    label: "Total area",
    unit: "km2",
    envelope: { min: 0.4, max: 18_000_000 },
  },
  {
    key: "area_land_km2",
    group: "A",
    category: "geography",
    label: "Land area",
    unit: "km2",
    envelope: { min: 0.4, max: 18_000_000 },
  },
  {
    key: "area_water_km2",
    group: "A",
    category: "geography",
    label: "Water area",
    unit: "km2",
    envelope: { min: 0, max: 18_000_000 },
  },
  { key: "time_zones", group: "A", category: "geography", label: "Time zones" },
  {
    key: "internet_tld",
    group: "A",
    category: "communications",
    label: "Internet TLD",
  },
  {
    key: "calling_code",
    group: "A",
    category: "communications",
    label: "Calling code",
  },
  {
    key: "drives_on_side",
    group: "A",
    category: "transport",
    label: "Drives on side",
  },
  {
    key: "national_holidays",
    group: "A",
    category: "identity",
    label: "National holidays",
  },
  {
    key: "independence_date",
    group: "A",
    category: "identity",
    label: "Independence date",
  },
  {
    key: "formation_date",
    group: "A",
    category: "identity",
    label: "Formation date",
  },
  {
    key: "un_admission_date",
    group: "A",
    category: "identity",
    label: "UN admission date",
  },
  {
    key: "neighbouring_countries",
    group: "A",
    category: "geography",
    label: "Neighbouring countries",
  },
  // Geography that is technically Group A (slow-changing identity-shaped)
  // but lives in CIA prose today. Mapped here so the resolver knows
  // they are slow-change facts.
  { key: "coastline", group: "A", category: "geography", label: "Coastline length",
    unit: "km",
    envelope: { min: 0, max: 250_000 },
  },
];

// ─────────────────────────────────────────────────────────────────────
// GROUP B — fast-changing quantitative facts (~30 keys).
// Default policy: fresher allow-listed source wins, subject to Guard 1
// + Guard 2 (methodology §3.3).
// ─────────────────────────────────────────────────────────────────────

const GROUP_B: FactKeyInput[] = [
  // Population stack.
  {
    key: "population_total",
    group: "B",
    category: "demographics",
    label: "Population",
    unit: "people",
    envelope: { min: 1_000, max: 2_000_000_000 },
    materialErrorPctThreshold: 0.5,
  },
  // Legacy-CIA alias key seeded as `population` (no _total).
  {
    key: "population",
    group: "B",
    category: "demographics",
    label: "Population",
    unit: "people",
    envelope: { min: 1_000, max: 2_000_000_000 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "population_growth_rate",
    group: "B",
    category: "demographics",
    label: "Population growth rate",
    unit: "%",
    envelope: { min: -10, max: 15, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  {
    key: "birth_rate",
    group: "B",
    category: "demographics",
    label: "Birth rate",
    unit: "per 1000",
    envelope: { min: 0, max: 60 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "death_rate",
    group: "B",
    category: "demographics",
    label: "Death rate",
    unit: "per 1000",
    envelope: { min: 0, max: 60 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "net_migration_rate",
    group: "B",
    category: "demographics",
    label: "Net migration rate",
    unit: "per 1000",
    envelope: { min: -50, max: 50 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "urbanization_rate",
    group: "B",
    category: "demographics",
    label: "Urbanization rate",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  {
    key: "life_expectancy",
    group: "B",
    category: "demographics",
    label: "Life expectancy at birth",
    unit: "years",
    envelope: { min: 20, max: 100 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "life_expectancy_years",
    group: "B",
    category: "demographics",
    label: "Life expectancy at birth",
    unit: "years",
    envelope: { min: 20, max: 100 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "fertility_rate",
    group: "B",
    category: "demographics",
    label: "Total fertility rate",
    unit: "births per woman",
    envelope: { min: 0, max: 10 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "infant_mortality_per_1000",
    group: "B",
    category: "demographics",
    label: "Infant mortality rate",
    unit: "per 1000 live births",
    envelope: { min: 0, max: 200 },
    higherIsBetter: false,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "median_age",
    group: "B",
    category: "demographics",
    label: "Median age",
    unit: "years",
    envelope: { min: 10, max: 70 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "literacy_rate",
    group: "B",
    category: "demographics",
    label: "Literacy rate",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },

  // Economy stack.
  {
    key: "gdp_nominal_usd_billions",
    group: "B",
    category: "economy",
    label: "GDP (nominal)",
    unit: "USD billions",
    envelope: { min: 0.05, max: 30_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "gdp_ppp_usd_billions",
    group: "B",
    category: "economy",
    label: "GDP (PPP)",
    unit: "USD billions",
    envelope: { min: 0.05, max: 40_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  // Legacy CIA seeded key.
  {
    key: "gdp_ppp",
    group: "B",
    category: "economy",
    label: "GDP (PPP)",
    unit: "USD",
    envelope: { min: 50_000_000, max: 40_000_000_000_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "gdp_per_capita_usd",
    group: "B",
    category: "economy",
    label: "GDP per capita",
    unit: "USD",
    envelope: { min: 50, max: 300_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  // Legacy CIA alias.
  {
    key: "gdp_per_capita_ppp",
    group: "B",
    category: "economy",
    label: "GDP per capita (PPP)",
    unit: "USD",
    envelope: { min: 50, max: 300_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "gdp_real_growth_rate",
    group: "B",
    category: "economy",
    label: "Real GDP growth rate",
    unit: "%",
    envelope: { min: -50, max: 50, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  // Legacy CIA alias.
  {
    key: "gdp_growth_rate",
    group: "B",
    category: "economy",
    label: "Real GDP growth rate",
    unit: "%",
    envelope: { min: -50, max: 50, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  {
    key: "inflation_rate",
    group: "B",
    category: "economy",
    label: "Inflation rate (consumer prices)",
    unit: "%",
    envelope: { min: -50, max: 1_000, isPercent: false },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    key: "inflation_rate_pct",
    group: "B",
    category: "economy",
    label: "Inflation rate (consumer prices)",
    unit: "%",
    envelope: { min: -50, max: 1_000 },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    key: "public_debt_pct_gdp",
    group: "B",
    category: "economy",
    label: "Public debt",
    unit: "% of GDP",
    envelope: { min: 0, max: 400, isPercent: false },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    // Phase R.2 — General government net lending/borrowing as % of GDP.
    // IMF WEO `GGXCNL_NGDP` is the canonical source; OECD (R.7) and
    // Eurostat (R.11) will alternate for OECD members + EU members
    // respectively. Currently 0 rows in `country_facts`; IMF closes
    // 0→~189 single-source coverage. See
    // `~/civica/plan/imf-weo-resolution-v1.md` §6 Q2.
    key: "fiscal_balance_pct_gdp",
    group: "B",
    category: "economy",
    label: "Fiscal balance (general government)",
    unit: "% of GDP",
    envelope: { min: -50, max: 50, isPercent: false },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    key: "unemployment_rate",
    group: "B",
    category: "economy",
    label: "Unemployment rate",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    key: "unemployment_rate_pct",
    group: "B",
    category: "economy",
    label: "Unemployment rate",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    key: "exports_total",
    group: "B",
    category: "economy",
    label: "Exports",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "exports_total_usd",
    group: "B",
    category: "economy",
    label: "Exports",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "imports_total",
    group: "B",
    category: "economy",
    label: "Imports",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "imports_total_usd",
    group: "B",
    category: "economy",
    label: "Imports",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "current_account_balance_usd",
    group: "B",
    category: "economy",
    label: "Current account balance",
    unit: "USD",
    envelope: { min: -2_000_000_000_000, max: 2_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "foreign_exchange_reserves_usd",
    group: "B",
    category: "economy",
    label: "Foreign exchange reserves",
    unit: "USD",
    envelope: { min: 0, max: 5_000_000_000_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "taxes_revenues_pct_gdp",
    group: "B",
    category: "economy",
    label: "Tax revenue",
    unit: "% of GDP",
    envelope: { min: 0, max: 100, isPercent: false },
    materialErrorPpThreshold: 50,
  },
  {
    key: "budget_revenue",
    group: "B",
    category: "economy",
    label: "Government revenue",
    unit: "USD",
    envelope: { min: 0, max: 10_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "budget_expenditure",
    group: "B",
    category: "economy",
    label: "Government expenditure",
    unit: "USD",
    envelope: { min: 0, max: 10_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },

  // Communications + energy + military quantitative.
  {
    key: "internet_users_pct",
    group: "B",
    category: "communications",
    label: "Internet users",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    key: "broadband_subscriptions",
    group: "B",
    category: "communications",
    label: "Fixed broadband subscriptions",
    unit: "subscriptions",
    envelope: { min: 0, max: 1_000_000_000 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "mobile_subscriptions",
    group: "B",
    category: "communications",
    label: "Mobile cellular subscriptions",
    unit: "subscriptions",
    envelope: { min: 0, max: 2_500_000_000 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "electricity_consumption_kwh",
    group: "B",
    category: "energy",
    label: "Electricity consumption",
    unit: "kWh",
    envelope: { min: 0, max: 1e14 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "electricity_generation_kwh",
    group: "B",
    category: "energy",
    label: "Electricity generation",
    unit: "kWh",
    envelope: { min: 0, max: 1e14 },
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "electricity_access",
    group: "B",
    category: "energy",
    label: "Access to electricity",
    unit: "%",
    envelope: { min: -1, max: 101, isPercent: true },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    key: "co2_emissions_total_mt",
    group: "B",
    category: "environment",
    label: "CO₂ emissions",
    unit: "Mt",
    envelope: { min: 0, max: 20_000 },
    higherIsBetter: false,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "military_expenditure_pct_gdp",
    group: "B",
    category: "military",
    label: "Military expenditure",
    unit: "% of GDP",
    envelope: { min: 0, max: 100, isPercent: false },
    materialErrorPpThreshold: 50,
  },
  {
    key: "refugee_count",
    group: "B",
    category: "demographics",
    label: "Refugees hosted",
    unit: "people",
    envelope: { min: 0, max: 50_000_000 },
    materialErrorPctThreshold: 0.5,
  },
];

// ─────────────────────────────────────────────────────────────────────
// GROUP C — categorical / structural facts that age slowly (~25 keys).
// Default policy: stays with CIA. Wikidata is recorded but never wins
// silently (methodology §3.5).
// ─────────────────────────────────────────────────────────────────────

const GROUP_C: FactKeyInput[] = [
  {
    key: "government_type",
    group: "C",
    category: "government",
    label: "Government type (CIA descriptor)",
  },
  // ── Peer-grouping classifications (Phase F.2.1, sourced from
  //    World Bank + V-Dem; see ~/civica/plan/phase-f-implementation-plan.md
  //    F.2.1 + ~/Downloads/resolution\ \(2\).md) ──
  //
  // These four are external classification fields used as the
  // analytical peer-grouping primitives across the site (replacing
  // the retired heuristic `structural_family`).
  //
  // - world_bank_region / world_bank_income_group: World Bank
  //   classifications, refreshed annually (July). No CIA equivalent.
  //   Treated as Group B in spirit — the resolver's "fresher allow-
  //   listed source wins" rule applies; with WB as the only source
  //   the single-source case (§3.1) handles it.
  // - vdem_row: V-Dem Regimes of the World, 4 buckets (Closed
  //   Autocracy / Electoral Autocracy / Electoral Democracy /
  //   Liberal Democracy). Annual release. Same Group-B-in-spirit
  //   treatment.
  // - monarchy_status: descriptive metadata enum. Group C: CIA-
  //   derived from the existing `government_type_detail` prose; no
  //   Wikidata override.
  //
  // Tagged Group A here for `world_bank_region` because regional
  // assignment is a slow-changing identity-like fact (countries
  // don't typically migrate between regions). The other two get
  // Group B because income classifications and democracy
  // classifications can shift year-to-year.
  {
    key: "world_bank_region",
    group: "A",
    category: "identity",
    label: "World Bank region",
  },
  {
    key: "world_bank_income_group",
    group: "B",
    category: "economy",
    label: "World Bank income group",
  },
  {
    key: "vdem_row",
    group: "B",
    category: "government",
    label: "V-Dem Regimes of the World",
  },
  {
    key: "monarchy_status",
    group: "C",
    category: "government",
    label: "Monarchy status",
  },
  {
    // Free-text government form description from CIA Factbook —
    // descriptive metadata, NOT an analytical taxonomy. Replaces
    // the structural_family heuristic per the 2026-05-02
    // peer-grouping resolution.
    key: "government_form_description",
    group: "C",
    category: "government",
    label: "Government form (descriptive)",
  },
  {
    key: "chief_of_state_title",
    group: "C",
    category: "government",
    label: "Chief of state title",
  },
  {
    key: "head_of_government_title",
    group: "C",
    category: "government",
    label: "Head of government title",
  },
  {
    key: "capital_coordinates",
    group: "C",
    category: "government",
    label: "Capital coordinates",
  },
  {
    key: "electoral_system",
    group: "C",
    category: "government",
    label: "Electoral system",
  },
  {
    key: "suffrage_age",
    group: "C",
    category: "government",
    label: "Suffrage age",
    unit: "years",
    envelope: { min: 12, max: 25 },
  },
  {
    key: "legal_system_family",
    group: "C",
    category: "government",
    label: "Legal system family",
  },
  // Breakdowns — value_json shape per fact-key. These are the only
  // Group C facts where census-derived NSO data may override CIA after
  // a data_disputes review (methodology §3.5 exception).
  {
    key: "religion_breakdown",
    group: "C",
    category: "society",
    label: "Religion breakdown",
  },
  // Legacy alias.
  {
    key: "religions",
    group: "C",
    category: "society",
    label: "Religions",
  },
  {
    key: "ethnic_groups_breakdown",
    group: "C",
    category: "society",
    label: "Ethnic group breakdown",
  },
  {
    key: "ethnic_groups",
    group: "C",
    category: "society",
    label: "Ethnic groups",
  },
  {
    key: "language_family",
    group: "C",
    category: "society",
    label: "Language family",
  },
  {
    key: "languages",
    group: "C",
    category: "society",
    label: "Languages",
  },
  // Geography prose / categorical.
  {
    key: "climate_type",
    group: "C",
    category: "geography",
    label: "Climate type",
  },
  {
    key: "climate",
    group: "C",
    category: "geography",
    label: "Climate",
  },
  {
    key: "terrain_summary",
    group: "C",
    category: "geography",
    label: "Terrain summary",
  },
  {
    key: "terrain",
    group: "C",
    category: "geography",
    label: "Terrain",
  },
  {
    key: "natural_resources",
    group: "C",
    category: "geography",
    label: "Natural resources",
  },
  {
    key: "land_use_breakdown",
    group: "C",
    category: "geography",
    label: "Land use breakdown",
  },
  {
    key: "agricultural_products",
    group: "C",
    category: "economy",
    label: "Agricultural products",
  },
  // Legacy alias.
  {
    key: "agriculture_products",
    group: "C",
    category: "economy",
    label: "Agricultural products",
  },
  {
    key: "industries",
    group: "C",
    category: "economy",
    label: "Industries",
  },
  {
    key: "export_commodities",
    group: "C",
    category: "economy",
    label: "Export commodities",
  },
  {
    key: "export_partners",
    group: "C",
    category: "economy",
    label: "Export partners",
  },
  {
    key: "import_partners",
    group: "C",
    category: "economy",
    label: "Import partners",
  },
  {
    key: "irrigated_land_km2",
    group: "C",
    category: "geography",
    label: "Irrigated land",
    unit: "km2",
    envelope: { min: 0, max: 1_000_000 },
  },
  // Legacy CIA "land area" / "water area" / "total area" came in as
  // Group A above. The legacy `land_area` / `water_area` / `total_area`
  // string-shaped CIA rows live alongside as Group C aliases — CIA
  // wording stays canonical until Wikidata/WB rows arrive.
  {
    key: "land_area",
    group: "C",
    category: "geography",
    label: "Land area (CIA descriptor)",
  },
  {
    key: "water_area",
    group: "C",
    category: "geography",
    label: "Water area (CIA descriptor)",
  },
  {
    key: "total_area",
    group: "C",
    category: "geography",
    label: "Total area (CIA descriptor)",
  },
  {
    key: "environmental_treaties_signed",
    group: "C",
    category: "environment",
    label: "Environmental treaties (signed)",
  },
  {
    key: "environmental_treaties_ratified",
    group: "C",
    category: "environment",
    label: "Environmental treaties (ratified)",
  },
  {
    key: "dispute_text",
    group: "C",
    category: "geography",
    label: "Transnational disputes",
  },
  // Military Group C narrative / structural.
  {
    key: "military_branches",
    group: "C",
    category: "military",
    label: "Military branches",
  },
  {
    key: "military_service_age",
    group: "C",
    category: "military",
    label: "Military service age",
  },
];

// Fold the three groups into a single frozen registry. The
// `factKey` alias is populated here from `key` so callers can read
// either field. Duplicate `key` strings throw at module load
// (caught by the test harness).
function withAlias(defs: FactKeyInput[]): FactKeyDefinition[] {
  return defs.map((d) => ({ ...d, factKey: d.key }));
}

const ALL_DEFINITIONS: readonly FactKeyDefinition[] = Object.freeze([
  ...withAlias(GROUP_A),
  ...withAlias(GROUP_B),
  ...withAlias(GROUP_C),
]);

function buildRegistry(): Record<string, FactKeyDefinition> {
  const out: Record<string, FactKeyDefinition> = {};
  for (const def of ALL_DEFINITIONS) {
    if (out[def.key]) {
      throw new Error(
        `Duplicate fact_key definition: '${def.key}' appears in more than one group`,
      );
    }
    out[def.key] = def;
  }
  return out;
}

export const FACT_KEYS: Record<string, FactKeyDefinition> = buildRegistry();

/** Look up a fact-key definition by its string key. */
export function getFactKey(key: string): FactKeyDefinition | undefined {
  return FACT_KEYS[key];
}

/** Return all fact-keys in a given group, in registration order. */
export function getFactKeysByGroup(group: FactGroup): FactKeyDefinition[] {
  return ALL_DEFINITIONS.filter((d) => d.group === group);
}

/** Total registered fact-keys. */
export function getFactKeyCount(): number {
  return ALL_DEFINITIONS.length;
}
