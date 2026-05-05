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
    // R.2.1 — envelope widened from 30_000 to 60_000 to accommodate IMF
    // WEO 5-year forecast-horizon values. USA 2031 forecast = $39.0T
    // (39,031 bn) exceeded the prior max calibrated for current-year
    // actuals. 60_000 ($60T) provides margin through the ~2031 horizon for
    // the largest economies. See ~/civica/plan/imf-weo-resolution-v1.md §3b.
    envelope: { min: 0.05, max: 60_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "gdp_ppp_usd_billions",
    group: "B",
    category: "economy",
    label: "GDP (PPP)",
    unit: "USD billions",
    // R.2.1 — envelope widened from 40_000 to 80_000 to accommodate IMF
    // WEO 5-year forecast-horizon values. China 2031 PPP forecast = $58.1T
    // (58,100 bn) exceeded the prior max. PPP aggregates grow faster than
    // nominal given international-dollar rebasing; 80_000 ($80T) provides
    // margin for the largest PPP economy through the ~2031 horizon.
    // See ~/civica/plan/imf-weo-resolution-v1.md §3b.
    envelope: { min: 0.05, max: 80_000 },
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
    // Threshold raised 50 → 300 (2026-05-05) to permit hyperinflation upgrades.
    // Argentina 2022→2024 moved 73.1% → 219.9% (147 pp gap), a confirmed
    // hyperinflationary episode (IMF, WB, OWID all report ~210–220% for
    // Argentina 2024). The 50 pp ceiling treated this as a data error and
    // pinned canonical to a 2-year-stale CIA reading. 300 pp comfortably
    // handles Argentina + Venezuela + Turkey-class episodes while still
    // catching gross errors (e.g., a decimal-error reading of 2,190%
    // would still trip at 2,117 pp gap > 300).
    // Audit trail: ~/civica/plan/canonical-pick-vs-freshness-investigation-v1.md
    materialErrorPpThreshold: 300,
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
    // Threshold raised 50 → 300 (2026-05-05) — companion to inflation_rate
    // hot-fix. DB probe found 4 blocked cases (Bolivia, Eritrea, Somalia,
    // Venezuela), all confirmed real-world economic events on stale CIA
    // snapshots: Bolivia post-COVID rise (53.7 pp); Eritrea opaque
    // accumulation (127.6 pp); Somalia HIPC debt relief Dec 2023 — $4.5B
    // written off (80.3 pp); Venezuela economic collapse (269.8 pp). Same
    // C1 methodology as inflation_rate; 300 pp comfortably handles
    // Venezuela (max gap) while still catching gross errors.
    // Audit trail: ~/civica/plan/canonical-pick-vs-freshness-investigation-v1.md §11c
    materialErrorPpThreshold: 300,
  },
  {
    // Phase R.2 — General government net lending/borrowing as % of GDP.
    // IMF WEO `GGXCNL_NGDP` is the canonical source; OECD (R.7) and
    // Eurostat (R.11) will alternate for OECD members + EU members
    // respectively. Currently 0 rows in `country_facts`; IMF closes
    // 0→~189 single-source coverage. See
    // `~/civica/plan/imf-weo-resolution-v1.md` §6 Q2.
    //
    // R.2.1 — envelope floor widened from -50 to -100 to accommodate IMF
    // WEO 5-year forecast-horizon values. Timor-Leste 2031 fiscal balance
    // forecast = -51.7% of GDP, just below the prior floor. Small/oil-
    // dependent economies with large resource-fund drawdown cycles can have
    // swings past ±50%. Max stays at 50 (no positive outlier observed in
    // the April 2026 WEO). See ~/civica/plan/imf-weo-resolution-v1.md §3b.
    key: "fiscal_balance_pct_gdp",
    group: "B",
    category: "economy",
    label: "Fiscal balance (general government)",
    unit: "% of GDP",
    envelope: { min: -100, max: 50, isPercent: false },
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
  // ─── Phase R.10 — ILO ILOSTAT canonical labour-market fact-keys
  //     (3 new declarations). Each Group B, category economy, envelope
  //     [0, 100, isPercent: true]. ILO is single-source canonical at
  //     ship time; OECD R.7 explicitly deferred LFS scope to R.10 and
  //     WB does not publish these as standalone indicators (only its
  //     republished ILO unemployment series). See
  //     `~/civica/plan/ilo-ilostat-resolution-v1.md` §2b + §6 Q1. ───
  {
    // ILO `EAP_2WAP_SEX_AGE_RT_A` — Labour force participation rate
    // by sex and age (ILO modelled estimates, Nov. 2025). Probe
    // 2026-05-04: range 31.6% (Yemen 2024) to 89.4% (Tanzania 2024)
    // across 276 ref_areas. Identity transform — ILO ships %, our
    // unit is %.
    //
    // higherIsBetter undefined: more LFPR is generally good for
    // economic capacity but the standard interpretation isn't
    // unambiguous (high LFPR may reflect distress informal-sector
    // participation in low-income countries).
    key: "labor_force_participation_rate_pct",
    group: "B",
    category: "economy",
    label: "Labour force participation rate",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  {
    // ILO `EMP_2WAP_SEX_AGE_RT_A` — Employment-to-population ratio
    // by sex and age (ILO modelled estimates, Nov. 2025). Probe
    // 2026-05-04: range 22.7% (Yemen 2024) to 87.3% (Tanzania 2024)
    // across 276 ref_areas. Identity transform.
    //
    // higherIsBetter undefined: same caveat as LFPR — the
    // employment-pop ratio is a structural indicator that shouldn't
    // be ranked simplistically.
    key: "employment_pop_ratio_pct",
    group: "B",
    category: "economy",
    label: "Employment-to-population ratio",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    materialErrorPpThreshold: 50,
  },
  {
    // ILO `SDG_0111_SEX_AGE_RT_A` — SDG indicator 1.1.1 Working
    // poverty rate (% of employed living below US$3 PPP per day).
    // Probe 2026-05-04: range 0.099% (Argentina 2024) to ~63%
    // (DRC, Burundi, Madagascar typical) across 193 ref_areas.
    // High-income countries are not measured separately by ILO
    // (statistically near-zero); coverage smaller than LFS-suite
    // indicators (~165 Civica jurisdictions vs ~190 for unemployment).
    //
    // higherIsBetter: false — lower working poverty rate is
    // unambiguously preferred. SDG target is 0%.
    key: "working_poor_rate_pct",
    group: "B",
    category: "economy",
    label: "Working poverty rate (SDG 1.1.1)",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  // Phase R.12 — `exports_total`, `exports_total_usd`, `imports_total`,
  // `imports_total_usd` removed.
  //
  // Replaced by the two-fact-key trade aggregate split per
  // `~/civica/plan/trade-aggregate-fact-keys-v1.md` §2d (ADOPTED
  // 2026-05-04). The two legacy `_usd` declarations and two CIA-prose
  // aliases were collapsed into:
  //   - `exports_merchandise_usd` (WTO Stats canonical) — goods only
  //   - `exports_goods_services_usd` (World Bank canonical) — goods + services
  //   - `imports_merchandise_usd` (WTO Stats canonical) — goods only
  //   - `imports_goods_services_usd` (World Bank canonical) — goods + services
  //
  // The 171 + 171 WB rows for `exports_total_usd` / `imports_total_usd`
  // and the 210 + 209 CIA rows for the legacy `exports_total` /
  // `imports_total` aliases were renamed in-place via SQL UPDATE during
  // R.12's first sync run (idempotent: the migration is gated by a
  // `WHERE fact_key = '<old>'` check that no-ops on subsequent runs).
  // CIA's prose values fold into `_goods_services_usd` because CIA
  // reports goods+services in its Factbook glossary; WB's `civicaRole`
  // flips back to `'canonical'` since WB is the canonical publisher of
  // the goods+services aggregate post-R.12.
  //
  // Per `~/civica/plan/wto-stats-resolution-v1.md` §3.4.
  {
    key: "exports_merchandise_usd",
    group: "B",
    category: "economy",
    label: "Exports of merchandise",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
    // higherIsBetter: undefined — more exports is not unambiguously
    // "better" (export concentration risks, currency-driven swings,
    // commodity vs. manufacturing mix all complicate the value-judgment).
  },
  {
    key: "exports_goods_services_usd",
    group: "B",
    category: "economy",
    label: "Exports of goods and services",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "imports_merchandise_usd",
    group: "B",
    category: "economy",
    label: "Imports of merchandise",
    unit: "USD",
    envelope: { min: 100_000, max: 5_000_000_000_000 },
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "imports_goods_services_usd",
    group: "B",
    category: "economy",
    label: "Imports of goods and services",
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
  // Phase R.7.5 — `taxes_revenues_pct_gdp` removed.
  //
  // The legacy `taxes_revenues_pct_gdp` declaration was a CIA-prose-mapped
  // slot intended for CIA Factbook's "Taxes and other revenues" indicator,
  // but no sync ever wrote rows to it (verified 2026-05-04: 0 rows in
  // `country_facts`). Phase R.7.5 introduces `tax_revenue_pct_gdp` as the
  // OECD-canonical replacement (Group B, economy, Revenue Statistics
  // SECTOR=S13/STANDARD_REVENUE=_T/UNIT_MEASURE=PT_B1GQ harmonized
  // methodology) — see the GROUP_B additions block below and
  // `~/civica/plan/fact-key-registry-expansion-resolution-v1.md` §2c.ii / §7
  // Q1 (sign-off Option B: remove).
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

  // ─── Phase R.6 — UNDP HDR composite + components (5 new fact-keys).
  //     UNDP is the sole publisher of the HDI composite, so HDI score
  //     and HDI rank have no canonical/alternate ambiguity. The 3
  //     component fact-keys (GNI per capita PPP, expected years of
  //     schooling, mean years of schooling) are tagged via the
  //     sync-orchestrator's `civicaRole` field per indicator, NOT
  //     here — fact-keys.ts is source-agnostic. See
  //     ~/civica/plan/undp-hdi-resolution-v1.md §2c, §2e. ───
  {
    key: "hdi_score",
    group: "B",
    category: "society",
    label: "Human Development Index (HDI)",
    unit: "index (0–1)",
    // UNDP's HDI composite is bounded [0, 1] by construction. The
    // 2023 vintage range observed: 0.394 (Somalia) to 0.972
    // (Switzerland). Envelope [0, 1] is exact.
    envelope: { min: 0, max: 1 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "hdi_rank",
    group: "B",
    category: "society",
    label: "HDI rank (UNDP)",
    unit: "rank",
    // UNDP ranks ~193 jurisdictions in the 2023 vintage; envelope
    // max 250 absorbs future expansions. lower rank = better;
    // Norway #2, Switzerland #1, Somalia #193.
    envelope: { min: 1, max: 250 },
    higherIsBetter: false,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "gni_per_capita_ppp_usd",
    group: "B",
    category: "economy",
    label: "GNI per capita (PPP, constant 2017 international $)",
    unit: "international $ (2017 PPP)",
    // UNDP uses CONSTANT 2017 PPP USD (different methodology from
    // WB's NY.GDP.PCAP.PP.CD which is current PPP USD). Distinct
    // fact-key from `gdp_per_capita_usd` — no double-write conflict.
    // 2023 vintage range: $700 (Burundi) to $112,710 (Norway);
    // Liechtenstein/Monaco can exceed $140k. Envelope [100, 200_000]
    // gives margin for the highest-income jurisdictions.
    envelope: { min: 100, max: 200_000 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.8,
  },
  {
    key: "expected_years_schooling",
    group: "B",
    category: "society",
    label: "Expected years of schooling",
    unit: "years",
    // UNDP's HDI methodology caps EYS at 18 years for the index
    // calculation; raw values can exceed 18 (Australia 21.0 in some
    // vintages). Envelope [0, 25] gives generous margin. UNDP
    // canonical for v1; flips to UNESCO alternate when R.7.5 ships.
    envelope: { min: 0, max: 25 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },
  {
    key: "mean_years_schooling",
    group: "B",
    category: "society",
    label: "Mean years of schooling (adults 25+)",
    unit: "years",
    // 2023 vintage range: 1.41 (Niger) to 13.9+ (USA / Czechia).
    // Envelope [0, 20] is conservative.
    //
    // R.7.5 — canonical-flip enacted: UNESCO UIS (`MYS.1T8.AG25T99`,
    // 199 ISO3 coverage) is now the editorial canonical via
    // `sync-unesco-uis.ts` config; UNDP HDR (which republishes
    // UNESCO) flips to alternate via `sync-undp-hdi.ts` config. The
    // 187 existing UNDP rows flip on next idempotent re-sync. See
    // `~/civica/plan/fact-key-registry-expansion-resolution-v1.md` §3.
    envelope: { min: 0, max: 20 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },

  // ─── Phase R.7.5 — fact-key registry expansion (12 new fact-keys).
  //     Consolidates the deferrals from R.4 WHO (5 health), R.5 UNESCO
  //     (5 education), and R.7 OECD (2 economy) into one batch.
  //     Each entry's envelope, isPercent flag, materialError threshold,
  //     and `higherIsBetter` direction are derived from live upstream
  //     probes (2026-05-04). See
  //     `~/civica/plan/fact-key-registry-expansion-resolution-v1.md`
  //     §2 + Appendix A for the per-fact-key methodology table. ───

  // Health — 5 fact-keys (WHO GHO canonical, sourced via
  // `sync-who-gho.ts`; `health_expenditure_pct_gdp` is shared canonical
  // with OECD SHA per resolution L3).
  {
    // WHO GHO `WHOSIS_000002` (HALE at birth, both sexes). Probe (2021):
    // min Lesotho 44.6, max Singapore 73.6. Conservative envelope
    // [20, 90] — 20 floor for extreme-conflict scenarios (Sierra
    // Leone bottomed near 36 in 2000); 90 ceiling for medical-progress
    // headroom for Singapore-class outliers.
    key: "healthy_life_expectancy_years",
    group: "B",
    category: "demographics",
    label: "Healthy life expectancy at birth",
    unit: "years",
    envelope: { min: 20, max: 90 },
    higherIsBetter: true,
    materialErrorPctThreshold: 0.5,
  },
  {
    // WHO GHO `MDG_0000000026` (maternal mortality ratio). Probe
    // (2023): min Cook Islands 0.1, max Nigeria 992.8. Sierra Leone
    // historically peaked near 1,200. Envelope max 2,000 absorbs any
    // conflict-zone outlier.
    key: "maternal_mortality_per_100000",
    group: "B",
    category: "demographics",
    label: "Maternal mortality ratio",
    unit: "per 100,000 live births",
    envelope: { min: 0, max: 2_000 },
    higherIsBetter: false,
    materialErrorPctThreshold: 0.5,
  },
  {
    // WHO GHO `MDG_0000000007` (under-5 mortality, with
    // `Dim3 eq 'WEALTHQUINTILE_TOTL'` filter). Probe (2023): min
    // San Marino 1.3, max Niger 118.5. Sierra Leone historically
    // peaked at ~225 in 2000 wartime; envelope max 250 provides
    // margin. Spelled-out `under_five_` matches existing
    // `infant_mortality_per_1000` convention.
    key: "under_five_mortality_per_1000",
    group: "B",
    category: "demographics",
    label: "Under-five mortality rate",
    unit: "per 1,000 live births",
    envelope: { min: 0, max: 250 },
    higherIsBetter: false,
    materialErrorPctThreshold: 0.5,
  },
  {
    // WHO GHO `NCDMORT3070` (probability of dying between 30-70 from
    // CVD/cancer/diabetes/CRD, both sexes). Probe (2021, BTSX): min
    // South Korea 6.9, max Kiribati 44.1. The underlying value is a
    // probability scaled to 0-100 — `isPercent: true` triggers
    // resolver percentage-clamp logic.
    key: "ncd_premature_mortality_pct",
    group: "B",
    category: "demographics",
    label: "NCD premature mortality (probability of dying between 30-70)",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    higherIsBetter: false,
    materialErrorPpThreshold: 50,
  },
  {
    // SHARED CANONICAL: WHO GHED `GHED_CHEGDP_SHA2011` (~190 ISO3
    // coverage) AND OECD SHA `DSD_SHA@DF_SHA/1.0` (51 ISO3 = 38
    // OECD members + 13 SHA partners). Both publishers compute
    // SHA-2011 joint methodology — values converge to ~0.1pp.
    // Resolver picks fresher within envelope; methodology page
    // renders both as editorial canonical for their respective
    // scopes. Probe (2022): WHO range 1.8-23.1%; OECD range
    // 2.7-16.5%. NOT `isPercent: true` because % of GDP follows
    // the public_debt_pct_gdp / military_expenditure_pct_gdp
    // convention. higherIsBetter undefined (USA at 16% is not
    // obviously "better" than Singapore at 4%).
    //
    // Tight materialErrorPpThreshold (2pp) catches material upstream
    // errors without flagging legitimate methodology-convergence
    // noise between WHO and OECD; year-over-year shifts are
    // typically <1pp.
    key: "health_expenditure_pct_gdp",
    group: "B",
    category: "economy",
    label: "Current health expenditure",
    unit: "% of GDP",
    envelope: { min: 0, max: 30, isPercent: false },
    materialErrorPpThreshold: 2,
  },

  // Education — 5 fact-keys (UNESCO UIS canonical, sourced via
  // `sync-unesco-uis.ts`). `out_of_school_rate_primary` deferred to
  // v1.1 per resolution Q4.
  {
    // UNESCO UIS `XGDP.FSGOV` (government expenditure on education
    // as % GDP). Probe (2020-2025): per-country range ~0.5-16.4%
    // (Cuba historic high). NOT a percent (% of GDP follows the
    // public_debt_pct_gdp convention). higherIsBetter true per
    // R.5 §2c — Q4 in resolution doc captures the caveat that
    // higher spending isn't unambiguously "better" but the
    // standard interpretation is positive.
    key: "government_education_expenditure_pct_gdp",
    group: "B",
    category: "economy",
    label: "Government education expenditure",
    unit: "% of GDP",
    envelope: { min: 0, max: 25, isPercent: false },
    higherIsBetter: true,
    materialErrorPpThreshold: 2,
  },
  {
    // UNESCO UIS `GER.1` (gross enrollment ratio, primary, both
    // sexes). Probe (2020+): min Somalia 20.9, max Sierra Leone 162.
    // GER routinely exceeds 100% because over-age and under-age
    // children get enrolled in primary — envelope max 200 provides
    // margin. NOT `isPercent: true` because the percentage-clamp
    // logic ([-1, 101]) would silently drop legitimate values >100.
    key: "gross_enrollment_ratio_primary_pct",
    group: "B",
    category: "society",
    label: "Gross enrollment ratio, primary",
    unit: "%",
    envelope: { min: 0, max: 200, isPercent: false },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    // UNESCO UIS `GER.2T3` (gross enrollment ratio, secondary,
    // both sexes; combined lower + upper secondary). Probe (2020+):
    // min Somalia 3.3, max Monaco 158.5. Same envelope/convention
    // as primary GER.
    key: "gross_enrollment_ratio_secondary_pct",
    group: "B",
    category: "society",
    label: "Gross enrollment ratio, secondary",
    unit: "%",
    envelope: { min: 0, max: 200, isPercent: false },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    // UNESCO UIS `CR.1` (primary education completion rate, both
    // sexes). Probe (2020+): min Niger 35.8, max Norway/Qatar 100.
    // Envelope [0, 100] matches the bounded probability domain;
    // `isPercent: true` triggers percentage-clamp.
    key: "completion_rate_primary_pct",
    group: "B",
    category: "society",
    label: "Primary education completion rate",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    higherIsBetter: true,
    materialErrorPpThreshold: 50,
  },
  {
    // UNESCO UIS `LR.AG15T99.GPIA` (gender parity index, adult
    // literacy). Probe (2018+): min Chad 0.42, max Lesotho 1.14.
    // GPI = (female literacy rate) / (male literacy rate); 1.0 =
    // parity. higherIsBetter undefined — closer to 1 is better,
    // but that semantic isn't representable as a single direction.
    // No `unit` string (matches existing convention for ratios
    // like `population_total`).
    key: "gender_parity_index_literacy",
    group: "B",
    category: "society",
    label: "Gender parity index, adult literacy",
    envelope: { min: 0, max: 2, isPercent: false },
    materialErrorPctThreshold: 0.5,
  },

  // Economy — 2 fact-keys (OECD canonical, sourced via
  // `sync-oecd-stat.ts`). Note that `health_expenditure_pct_gdp`
  // (above, Health block) is also shared canonical with OECD SHA.
  {
    // OECD MSTI `OECD.STI.STP,DSD_MSTI@DF_MSTI,1.3` with
    // `MEASURE=G & UNIT_MEASURE=PT_B1GQ`. Probe (2022-2024): min
    // Canada/Greece etc. ~1.8%, max Israel 6.7%, South Korea 5.1%.
    // Envelope max 10 provides ample headroom. higherIsBetter
    // true (proxy for innovation capacity).
    //
    // R.7.5 §5d: OECD MSTI scope extends beyond 38 OECD members
    // (probe showed 46 ISO3 incl ARG, BGR, CHN, HRV, ROU, SGP, TWN,
    // ZAF). Because OECD is the ONLY Tier-1 publisher of GERD,
    // sync-oecd-stat.ts drops the OECD-member-only filter for this
    // fact-key — all 46 ISO3 in MSTI's native scope are written.
    key: "gerd_pct_gdp",
    group: "B",
    category: "economy",
    label: "R&D expenditure (GERD)",
    unit: "% of GDP",
    envelope: { min: 0, max: 10, isPercent: false },
    higherIsBetter: true,
    materialErrorPpThreshold: 1,
  },
  {
    // OECD `OECD.CTP.TPS,DSD_REV_COMP_OECD@DF_RSOECD,2.0` with
    // `MEASURE=TAX_REV & SECTOR=S13 & STANDARD_REVENUE=_T &
    //  UNIT_MEASURE=PT_B1GQ & FREQ=A` — total tax revenue as % GDP
    // (general government, all standard revenue categories,
    // OECD-harmonized methodology). Probe (2022): min Mexico 16.8,
    // max France 45.9. Envelope max 60 provides margin (Denmark/
    // Sweden historically peaked near 50). higherIsBetter undefined
    // (politically charged).
    //
    // Distinct from the (now-removed) legacy `taxes_revenues_pct_gdp`
    // CIA-prose-mapped slot. OECD-member-only scope retained
    // (only OECD members report via Revenue Statistics).
    //
    // Looser materialErrorPpThreshold (5pp) than other fiscal
    // fact-keys because tax-as-share-of-GDP can move 2-3pp in a
    // single fiscal year (e.g. COVID stimulus year-on-year).
    key: "tax_revenue_pct_gdp",
    group: "B",
    category: "economy",
    label: "Tax revenue",
    unit: "% of GDP",
    envelope: { min: 0, max: 60, isPercent: false },
    materialErrorPpThreshold: 5,
  },

  // ─── Phase R.8 — FAO FAOSTAT Land Use (3 new fact-keys + 1 reuse).
  //     FAO is the upstream-canonical publisher for agriculture-,
  //     forestry-, and land-use-specific indicators; WB's
  //     `AG.LND.AGRI.ZS` and OECD's ENV-AGRI dataflow both republish
  //     FAO without methodological adjustment. Per
  //     `~/civica/plan/fao-faostat-resolution-v1.md` §2d.
  //
  //     All 4 R.8 indicators are Group B per user sign-off Q2
  //     (annual cadence, numerical, freshness-driven). The existing
  //     `irrigated_land_km2` slot (declared in Group C as a CIA-prose
  //     companion) is also flipped to Group B here — see comment on
  //     that fact-key below.
  //
  //     Mode B (declare-and-ship) per resolution Q1: 3 new fact-keys
  //     declared inline rather than deferred to a future R.7.5+
  //     batch. Master-plan flagships (`agricultural_land_pct`,
  //     `forest_area_pct`) need to land. ───
  {
    // FAO FAOSTAT Land Use Item 6610 (Agricultural land), Element
    // 7209 (Share in Land area). Probe (2023): min Suriname ~1%,
    // max Saudi Arabia ~81%, Brazil 28.33%, USA 45%. Bounded `[0,
    // 100]` by definition; `isPercent: true` triggers resolver
    // percentage-clamp.
    //
    // higherIsBetter undefined per resolution Q5 — direction is
    // genuinely ambiguous (food-security contexts favor higher;
    // deforestation-pressure contexts favor lower). Same convention
    // as `tax_revenue_pct_gdp`.
    key: "agricultural_land_pct",
    group: "B",
    category: "economy",
    label: "Agricultural land",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    materialErrorPpThreshold: 5,
  },
  {
    // FAO FAOSTAT Land Use Item 6646 (Forest land), Element 7209
    // (Share in Land area). Probe (2023): min Egypt 0.04%, max
    // Suriname 97%, Brazil 59.33%, USA 33.79%. Bounded `[0, 100]`
    // by definition.
    //
    // higherIsBetter undefined per resolution Q5 — for political
    // neutrality. Forest cover is broadly a positive ecological
    // indicator (biodiversity, carbon sequestration), but
    // baked-in direction is omitted to mirror `tax_revenue_pct_gdp`.
    key: "forest_area_pct",
    group: "B",
    category: "environment",
    label: "Forest area",
    unit: "%",
    envelope: { min: 0, max: 100, isPercent: true },
    materialErrorPpThreshold: 5,
  },
  {
    // FAO FAOSTAT Land Use Item 6610 (Agricultural land), Element
    // 5110 (Area). Probe (2023): min ~10 km² (small island states),
    // max Russia ~2.16M km², Brazil ~2.36M km² (236782.8 × 10),
    // USA ~4M km². Envelope max 50M provides ample headroom for
    // larger countries; the global-aggregate row would exceed it
    // and is filtered out by ISO3 lookup miss.
    //
    // FAO unit is `1000 ha`; transform `× 10` to `km2` (1 ha =
    // 0.01 km²; 1000 ha = 10 km²). Verified live 2026-05-04.
    //
    // higherIsBetter undefined — direction depends on country
    // context (food security favors higher; deforestation pressure
    // favors lower).
    key: "agricultural_land_km2",
    group: "B",
    category: "geography",
    label: "Agricultural land area",
    unit: "km2",
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
    // R.8 — flipped from Group C to Group B per user sign-off Q2.
    // The slot existed as a CIA-prose companion (legacy "irrigated
    // land" descriptor) but is now populated by FAO FAOSTAT Land
    // Use Item 6611 (Agriculture area actually irrigated) /
    // Element 5110 (Area), `1000 ha → km2` transform. Numeric,
    // annual cadence, freshness-driven — Group B is the correct
    // classification. Per
    // `~/civica/plan/fao-faostat-resolution-v1.md` §2e.
    key: "irrigated_land_km2",
    group: "B",
    category: "geography",
    label: "Irrigated land",
    unit: "km2",
    envelope: { min: 0, max: 1_000_000 },
    materialErrorPctThreshold: 0.5,
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
