/**
 * Phase F.2 — Wikidata property mapping.
 *
 * Maps each in-scope Civica fact-key to the Wikidata property used
 * for that measurement, plus any unit conversion needed to
 * normalise into the Civica fact's expected unit.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md §1.1, §3
 * Implementation plan: F.2.
 *
 * ## Coverage notes
 *
 * Original implementation plan F.2 listed 10 priority Group B
 * fact-keys to sync. Empirical probe (2026-05-02) of 7 reference
 * countries (USA, Germany, France, Nigeria, India, Brazil, UK)
 * showed Wikidata reliably carries 8 demographic + macro
 * properties for every probed entity. The remaining fact-keys
 * from the original list — `inflation_rate_pct`,
 * `public_debt_pct_gdp`, `gdp_per_capita_usd`,
 * `infant_mortality_per_1000`, `co2_emissions_total_mt`,
 * `internet_users_pct` — either have no stable Wikidata property
 * (CO2, internet users) or are sparsely populated (inflation,
 * debt, GDP/capita).
 *
 * Decision: F.2 syncs the 8 well-covered properties below.
 * Direct adapters for the remaining keys (World Bank WDI, IMF WEO)
 * land in F.6 — the multi-source expansion sub-phase. This is
 * documented in the Phase F open-questions doc and the F.2
 * coverage report.
 *
 * R.0 / 2026-05-03 update (per
 * `~/civica/plan/wikidata-sort-resolution-v1.md` §3): the table
 * below is now 7 entries, not 8. `gdp_per_capita_usd` has been
 * retired — it was the third in the original list of "sparsely
 * populated" fact-keys above, and direct measurement on
 * 2026-05-03 confirmed only 9 sovereign states carry P2132 at
 * all (versus 195 for P1082 population). Phase R.1 expands the
 * World Bank WDI sync to cover this fact-key directly.
 *
 * `birth_rate` and `death_rate` are unchanged in the table but
 * began producing rows after the same 2026-05-03 R.0 patch
 * extended `wikidata-client.ts` to also extract `pr:P123`
 * (publisher) references in addition to `pr:P248` (stated in).
 * The two demographic properties almost exclusively use P123 on
 * Wikidata; the prior reference-extraction code was silently
 * filtering all 188 sovereign-state claims out at the
 * "no admissible reference" gate.
 */

export interface WikidataFactConfig {
  /** Civica fact-key, must match an entry in `fact-keys.ts`. */
  factKey: string;
  /** Wikidata property ID, e.g. "P1082". */
  pid: string;
  /** Wikidata Q-ID of the unit this property's values are
   *  expressed in, where applicable. Used to detect surprising
   *  unit mismatches at sync time. Q199 is "1" (dimensionless). */
  expectedUnitQid?: string;
  /** Multiplier to convert Wikidata's stored value to the Civica
   *  fact's expected unit. E.g. P2131 stores GDP in absolute USD;
   *  Civica's `gdp_nominal_usd_billions` wants billions, so 1e-9.
   *  Defaults to 1 (no conversion). */
  unitMultiplier?: number;
  /** Human-readable description of the source-and-target unit
   *  alignment, for the sync report. */
  unitNote?: string;
}

/**
 * The F.2 / R.0 sync target list. Each entry is one fact-key; one
 * SPARQL query per (jurisdiction, entry). 7 entries × ~191
 * jurisdictions with `wikidata_qid` = ~1,337 SPARQL hits per
 * quarterly cron, well within Wikidata's politeness floor at our
 * 4 req/s throttle (this floor was 8×270 / 2,160 hits before R.0
 * retired the gdp_per_capita_usd entry; the runtime budget is
 * unchanged in scale).
 */
export const WIKIDATA_FACT_MAPPING: WikidataFactConfig[] = [
  {
    factKey: "population_total",
    pid: "P1082",
    expectedUnitQid: "Q199", // dimensionless
    unitNote: "headcount, no unit conversion",
  },
  {
    factKey: "gdp_nominal_usd_billions",
    pid: "P2131",
    expectedUnitQid: "Q4917", // United States dollar
    unitMultiplier: 1e-9,
    unitNote: "Wikidata stores absolute USD; Civica wants billions",
  },
  // R.0 / 2026-05-03: gdp_per_capita_usd Wikidata mapping retired.
  // SPARQL meta-query against Q3624078 (sovereign state) on
  // 2026-05-03 found that property P2132 has only 9 sovereign
  // states with any statement, and 0 sovereign states with a
  // referenced statement that survives the allowlist (the lone
  // pre-retirement DB row was Botswana, citing data.worldbank.org
  // via P854). This is upstream sparsity — Wikidata does not
  // carry GDP-per-capita for most countries — not a P-ID or
  // unit-conversion error, so no Wikidata-side code change can
  // fix it. The fact-key itself stays in `fact-keys.ts`; the
  // World Bank WDI sync (Phase R.1) provides the canonical
  // alternate, with CIA Factbook already covering primary. Per
  // resolution doc `~/civica/plan/wikidata-sort-resolution-v1.md`
  // §3 item 4. Botswana's existing pre-retirement Wikidata row
  // ages out harmlessly: the resolver picks the fresher CIA / WB
  // alternates and the orphaned Wikidata row drops from
  // multi-source coverage.
  {
    factKey: "unemployment_rate_pct",
    pid: "P1198",
    expectedUnitQid: "Q11229", // percent
    unitNote: "percent, no unit conversion",
  },
  {
    factKey: "life_expectancy_years",
    pid: "P2250",
    expectedUnitQid: "Q577", // year
    unitNote: "years, no unit conversion",
  },
  {
    factKey: "birth_rate",
    pid: "P8763",
    // Wikidata stores per-1000 (e.g. value 12.3 means 12.3/1000).
    // No conversion needed if Civica also stores per-1000.
    unitNote: "live births per 1,000 population per year",
  },
  {
    factKey: "death_rate",
    pid: "P10091",
    unitNote: "deaths per 1,000 population per year",
  },
  {
    factKey: "fertility_rate",
    pid: "P4841",
    unitNote: "average children per woman over lifetime",
  },
];

/**
 * Apply the unit multiplier to a raw Wikidata numeric value,
 * returning the value in the Civica fact's expected unit.
 *
 * Returns the parsed number, or null if the value isn't numeric.
 */
export function applyUnitConversion(
  config: WikidataFactConfig,
  rawValue: string
): number | null {
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return null;
  const mult = config.unitMultiplier ?? 1;
  return parsed * mult;
}
