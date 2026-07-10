# Factbook Reconciliation

<!-- Deferred mirror of src/app/(reader)/country/methodology/reconciliation/page.tsx -->
<!-- Values mirror src/lib/content/site-state.ts as of 2026-05-05; refresh in lockstep with state updates. -->

*How Civica picks one canonical value per country fact when multiple sources disagree, and how readers can audit the choice. Methodology v0.2-beta — perpetual-beta posture; the rules continue to refine, but vintaged data is stable.*

*Methodology v0.2-beta · First v1 vintage 2026-Q1 · Updated 2026-05-05*

> **Methodology in perpetual beta.** Civica is a research lab. Methodology decisions ship as version bumps (`v0.2-beta` → `v0.3-beta` → ...) rather than as a graduation event. Each quarterly vintage embeds the methodology version that produced it, so a citation pinned to `Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1` is stable: the underlying rules are tied to the label. See the version-policy section below for the full posture.

---

## What this is

Civica's factbook draws on multiple sources for the same underlying fact. The CIA World Factbook is comprehensive but stopped updating in January 2026. Wikidata is fresh but its claims vary in quality. Multilateral statistical agencies such as the World Bank, IMF, UN, and WHO publish official or established international series but cover narrower fact sets. National statistical offices (US Census, ONS-UK, INSEE-FR, Statistics Canada, IBGE-BR, Stats SA) publish official national statistics and often release them faster than multilateral datasets. For any given country and fact — Argentina's inflation, Brazil's population, the United Kingdom's consumer-price index — Civica may hold several candidate values from different sources, each with its own measurement date and reference chain.

The reconciliation layer is the rule-based system that picks one value to display, preserves the rest for transparency, and escalates disagreements that look like data errors or contested changes. The rules are deterministic: no language model, no confidence scores, no convergence loops. A third party with our inputs and the source allowlist must be able to reproduce the choice.

In the current live database, the canonical-fact layer holds rows across the declared fact-keys and active sources. Current publisher depth is greatest for economic and demographic fact-keys such as unemployment, population, inflation, and life expectancy. These are live totals, not attributes of the frozen 2026-Q1 vintage; the public page reads the exact figures from `getSiteStats()` at render time.

---

## Scope

We classify each fact into one of three groups by an explicit per-fact-key decision, not at runtime. The group determines how the resolver weights freshness against authority.

### Group A — Slow-changing identity facts

These facts barely move from year to year. Wording matters and readers cite them by name.

- Examples: capital, official short and long names, ISO 2/3 codes, currency code, official languages, total area in square kilometres, time zones, internet TLD, calling code.
- **Default:** CIA wording wins. Wikidata can override only when CIA is empty and the Wikidata claim has a Tier-1 or Tier-2 reference. Any silent override of a non-empty CIA value is a bug — the dispute path is the only way through.

### Group B — Fast-changing quantitative facts

These are the figures most likely to be stale on the frozen CIA file. Freshness is the priority.

- Examples: population, GDP nominal and PPP, GDP per capita, GDP growth, inflation, public debt as % of GDP, unemployment, life expectancy, electricity generation by source, internet users, CO2 emissions.
- **Default:** the fresher allow-listed source wins, subject to a material-error guard and a reference-quality floor. CIA is preserved as an alternate even when superseded.

### Group C — Categorical and structural facts

These age slowly and Wikidata's reference graph is thinnest here.

- Examples: government type (raw CIA string), chief of state title, electoral system, suffrage age, legal system family, religion breakdown, ethnic group breakdown, climate type, terrain summary, natural resources, land use breakdown.
- **Default:** CIA wins, full stop. The exception is census-derived breakdowns (religion, ethnicity) where a recent national census from an allow-listed national statistical office crosses a defined threshold; that triggers a dispute, never a silent swap.

### Out of scope

The reconciliation layer does not govern judgment claims — regime classification, human-rights status, contested geopolitical labels, "is X a democracy." Each of these has a named primary source with its own published ingestion path: [Civica Index](https://civicaatlas.org/civica-index/methodology) dimension scores (V-Dem, Freedom House, World Bank WGI, UNDP HDI, Transparency CPI, Global Peace Index), [Civica Pulse](https://civicaatlas.org/civica-index/methodology/pulse) events, the Bjornskov-Rode / CGV regime taxonomy, and constitutional text from the Constitute Project. Officeholders (heads of state, heads of government) and party seat counts are also out of scope — they have purpose-built sync paths that predate this layer.

### Country coverage policy

Civica's coverage policy follows the UN member-state and observer-state set, including the Holy See and Palestine, and also includes statistical entities with a user-assigned ISO 3166-1 code that the World Bank and IMF treat as distinct units, such as Kosovo. This mirrors the country lists used by Our World in Data, the World Bank, the UN Statistical Division, UNDP, and V-Dem. Civica makes no editorial claim about any country's sovereignty or recognition status — the coverage floor is "what UN agencies and the World Bank treat as a country," not Civica's own judgment.

For Palestine, two parallel records exist: territory-level CIA Factbook entries for the West Bank and Gaza Strip (preserving the Factbook's separate prose for each territory) sit alongside a unified `PSE` row that acts as the iso3-keyed reconciliation target for World Bank, IMF, WHO, UNDP, UNESCO, and V-Dem data. Kosovo is included under the user-assigned ISO code `XKX`, following World Bank, IMF, and UNDP practice. Western Sahara, Hong Kong, and other CIA Factbook territory entries remain in the database with their Factbook content but without iso3 codes — they receive only Civica's CIA Factbook treatment because Tier-1 publishers do not write separate rows for them.

---

## Sources

A Wikidata claim is accepted only if its references — via the `P248` "stated in" property or the `P854` reference URL — point to an entry on the allowlist. Allowlist entries are organised in four tiers; the full list lives in [`src/lib/factbook/reconcile/source-allowlist.ts`](https://github.com/fbalino/civica/blob/main/src/lib/factbook/reconcile/source-allowlist.ts) and is the single source of truth — both the schema and the resolver import from it.

### Tier 1 — Multilateral statistical agencies

- [World Bank Open Data](https://data.worldbank.org) — selected World Development Indicators.
- [International Monetary Fund](https://www.imf.org) — World Economic Outlook (WEO).
- [United Nations Statistics Division](https://unstats.un.org) — UN World Population Prospects + UNData portal.
- [UNDP Human Development Reports](https://hdr.undp.org) — HDI domain.
- [WHO Global Health Observatory](https://www.who.int/data/gho) — health indicators canonical.
- [UNESCO Institute for Statistics](https://uis.unesco.org) — literacy and education canonical.
- [OECD.Stat](https://stats.oecd.org) — OECD-member scope.
- [FAO FAOSTAT](https://www.fao.org/faostat) — agriculture domain.
- [ILO ILOSTAT](https://ilostat.ilo.org) — unemployment canonical (with measured-vs-projected partition for ILOEST nowcasts).
- [Eurostat](https://ec.europa.eu/eurostat) — EU-27 + EFTA-4 scope; multi-canonical-with-scope-predicate origin pattern.
- [WTO Stats](https://stats.wto.org) — merchandise trade canonical (with two-fact-key split against the World Bank's goods-and-services aggregate).

The International Energy Agency was scoped for v1 and **scrapped on 4 May 2026** after legal review: the IEA Terms of Use restrict redistribution to no more than five data points on an "occasional, ad-hoc basis," which is incompatible with Civica's quarterly cron and broad cross-country redistribution model. No commercial budget was allocated to upgrade. The audit trail for the scrap decision is preserved as an internal resolution document; the v1 commitment is the active publisher roster above.

### Tier 2 — National statistical offices

The methodology page named the initial NSO wave during early design. The live and deferred offices are identified individually below, with specific blockers for each deferral. New NSOs are added on demand — when a fact-key for a specific country has no Tier-1 coverage, an NSO publishes the relevant official national series, or readers ask for it. Subsequent waves will pursue broader NSO coverage. Every addition triggers a methodology version bump.

- **US Census Bureau** (live) — ACS 1-Year + Decennial; population, unemployment, urbanisation indicators for the United States.
- **ONS-UK** (live) — public time-series API; population, CPIH inflation, GDP real growth, unemployment for the United Kingdom.
- **INSEE-FR** (live) — SDMX-XML; population, inflation, GDP, unemployment for France. First non-English-language NSO precedent.
- **Statistics Canada** (live) — Web Data Service; population, inflation, GDP, unemployment for Canada.
- **IBGE-BR** (live) — SIDRA REST; population, IPCA inflation, PNADC unemployment, real GDP growth for Brazil. First Portuguese-only NSO precedent.
- **Stats SA** (live) — PDF release ingest via Anthropic SDK native PDF support; population, CPI inflation, QLFS unemployment, quarterly GDP for South Africa. First PDF-extraction NSO precedent.
- **Destatis-DE** (deferred to v1.1) — the Genesis-Online API requires manual account creation with regulatory review, which falls outside Civica's unattended-cron architecture. Eurostat republishes Destatis figures within weeks at harmonised methodology, so Germany has Tier-1 coverage today via Eurostat. Destatis ships when the registration step is automated or manual provisioning becomes feasible.
- **NBS-Nigeria** (permanently deferred per 2026-05-05 user resolution) — primary data is PDF/Excel; ingestion cost is not justified for v1. Nigeria retains Tier-1 coverage from World Bank, IMF, UN, and UNDP. Reopened only if a structured-API surface lands or the data-shape decision is revisited.

### Tier 3 — CIA World Factbook

The CIA file is public-domain and remains the default for identity facts (Group A) and categorical facts (Group C), regardless of what Wikidata claims. It is treated as frozen-as-of January 2026.

### Tier 4 — Wikidata as a structured pipe

A Wikidata claim is never "self-citing" for our purposes. What we trust is the Tier-1 or Tier-2 source the claim points at; Wikidata is the structured query path. A Wikidata claim with no allow-listed reference is rejected at sync time and never enters the canonical store.

### Explicitly rejected references

Wikidata claims whose only references are imported-from-Wikipedia (`P143`), Wikipedia itself, generic news aggregators (Worldometers, Statista's free tier), personal blogs, social media, self-published advocacy NGO claims for facts they are not the primary source of, or a Wikidata mirror of CIA Factbook (we want the primary CIA file directly). A claim with multiple references is accepted if at least one reference is on the allowlist; a majority is not required.

---

## The resolver

Given a country and a fact key, the resolver returns one canonical value plus the full list of alternates. Rules are evaluated in order. If only one source row exists for a fact, that value is used. Otherwise the rules below apply by group.

For Groups A and C, when sources agree within tolerance (within 2% for counts, within 0.5 percentage points for rates, exact match for strings after Unicode normalisation), CIA is preferred when present. For Group B the resolver does not short-circuit on agreement — even when CIA and a fresher source agree within tolerance, the fresher allow-listed source wins and CIA is preserved as an alternate. This is because freshness is the whole point for fast-changing facts.

When sources disagree, two guards apply for Group B:

- **Material-error rejection.** A fresher value differing from the older one by more than a per-category "impossible" threshold (population > 50% in a year, GDP nominal in USD > 80%, inflation and public-debt ratios > 300 percentage points) is rejected as likely data corruption or a unit-of-measure error. A dispute row is created and the prior canonical value remains until reviewed.
- **Reference-quality floor.** The fresher source must have at least one Tier-1 or Tier-2 reference. A Wikidata claim whose references are all rejected per the allowlist cannot win even if it is fresher.

**Frozen worked examples — methodology v0.2-beta, vintage 2026-Q1.** The eight examples that follow record the rows and resolver outcomes from that frozen release; they are not live database readouts. Each illustrates a distinct reconciliation pattern, and every value was probed against the resolver before this page shipped.

*Vintage note. Specific numerical values cited below reflect Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1. The exact figures are release-bound; the methodologically relevant claim in each example is the pattern of canonical/alternate attribution.*

### Worked example 1 — Argentina inflation, a hyperinflation-scale swing

**Pattern.** Group B fresher-source-wins under an elevated material-error threshold reserved for high-volatility fact-keys. `inflation_rate` and `public_debt_pct_gdp` both carry a 300 percentage-point material-error ceiling — wider than the ceiling on most Group B percentage fact-keys — because genuine hyperinflation and sovereign-debt-crisis episodes can move a country's reading by more than 100 percentage points in a single year without that swing being a data error.

**Frozen example rows.** The World Bank reports 219.88% (2024). The IMF World Economic Outlook reports 7.5% (2031, tagged as a projection). The CIA World Factbook reports 73.1% (2022, frozen).

**Resolver outcome.** The World Bank's 219.88% (2024) wins canonical with `decisionReason='fresher_winner'`. The gap between the World Bank's reading and the CIA's frozen 73.1% reading is 146.78 percentage points — within the 300 pp threshold for this fact-key, so the fresher reading is accepted rather than rejected as implausible. The CIA value moves to alternate.

**Story.** Argentina's inflation went from about 73% in 2022 to about 220% by 2024 during a real hyperinflation episode, not a data-entry mistake. `inflation_rate` and `public_debt_pct_gdp` carry the wider 300 pp ceiling specifically so that genuine hyperinflation- and debt-crisis-scale swings clear the material-error guard instead of pinning the canonical pick to a stale reading. Under this rule the resolver accepts the World Bank's fresher measurement and moves the CIA's outdated reading to the alternates panel.

### Worked example 2 — United States life expectancy, editorial canonical vs freshest

**Pattern.** Editorial-canonical assertion preserved alongside freshness-driven canonical pick. Two honest answers to two different questions: *who measured this* versus *what's the most recent measurement*.

**Frozen example rows.** The World Bank reports 78.89 years (2024). The CIA reports 80.9 years (2024, frozen). WHO Global Health Observatory reports 76.37 years (2021), tagged `civicaRole='canonical'` as the editorial-domain authority. UN WPP reports 77.05 years (2024). UNDP HDI reports 79.30 years (2023). Wikidata reports 77.0 years (2022).

**Resolver outcome.** UN WPP's 77.05 (2024) wins canonical with `decisionReason='fresher_winner'`. Multiple Tier-1 publishers (UN, World Bank, CIA) all carry a 2024 reading; the runtime canonical pick among same-vintage Tier-1 publishers is sensitive to the tied-date tiebreak ordering rather than to a methodology assertion (open question logged at v1.0-followup §3.1). The alternates panel renders WHO 76.37 (2021) labelled as the editorial canonical alongside the World Bank, CIA, UNDP, and Wikidata rows.

**Story.** WHO is the editorial canonical for `life_expectancy_years` because nearly every other major publisher republishes WHO's underlying GHO methodology. But WHO's last release for the United States was 2021 on its publisher cycle; UN, the World Bank, and the CIA all have 2024 readings that are fresher. Civica's resolver picks the freshest within-envelope row, while the alternates panel discloses the editorial canonical alongside. When WHO ships its 2024 release, the canonical pick will move back to WHO automatically — no methodology change needed. The longer expansion of this pattern lives in the "Editorial canonical vs displayed value" section below.

### Worked example 3 — GDP growth, mixed measurement methodologies

**Pattern.** Growth-methodology comparability rule, fact-key-scoped to `gdp_real_growth_rate`. Publishers report GDP growth on different measurement bases, and the raw numbers are *not* directly comparable. Each source row carries a `growth_methodology` label — `annual_yoy` (the comparable default; World Bank, IMF, Eurostat, and most national statistics offices), `four_quarter_accumulated_yoy` (Brazil's IBGE), and `qoq_seasonally_adjusted` (South Africa's Stats SA). The resolver reads this label to keep the canonical pick comparable.

**The rule.** When two or more publishers cover the same country on this fact-key and at least one reports annual year-on-year while at least one reports on a different basis, the resolver prefers the annual-YoY publisher — *unless* the non-annual publisher is more than twelve months fresher. A single quarter's quarter-on-quarter print should not outrank the comparable annual figure everyone else uses, but a genuinely more recent specialised measurement still wins.

**Brazil (rule fires).** IBGE reports 2.3% on a four-quarter accumulated basis (2025); the World Bank reports 3.4% annual year-on-year (2024). The IBGE figure is exactly twelve months fresher — not *more than* twelve — so the comparable annual-YoY World Bank value wins canonical with `decisionReason='fresher_winner'`. IBGE stays in the alternates panel, labelled with its four-quarter methodology.

**South Africa (specialised publisher held).** Stats SA reports 0.4% quarter-on-quarter, seasonally adjusted (2025); the World Bank reports 0.5% annual year-on-year (2024). Stats SA is roughly two years fresher — well past the twelve-month edge — so it keeps the canonical pick with `decisionReason='incumbent_held'`. Beside the reconciled figure the country page shows a small circled-i whose tooltip reads "Quarter-on-quarter, seasonally adjusted — not directly comparable to annual figures," and the full basis is recorded in the alternates panel. The reader is never handed a number measured on an undisclosed basis.

### Worked example 4 — United Kingdom inflation, NSO override

**Pattern.** NSO-as-canonical-override via freshness alone. The same multi-canonical-with-scope-predicate pattern, extended to country-singleton scope.

**Frozen example rows.** ONS-UK reports 3.9% CPIH (2025). The World Bank reports 3.27% (2024). The IMF reports 2.0% (2031, projected). The CIA reports 3.3% (2024, frozen).

**Resolver outcome.** ONS-UK's 3.9% (2025) wins canonical with `decisionReason='fresher_winner'`. CPIH (the UK's statistical concept that includes owner-occupied housing) has been the ONS headline measure since 2017.

**Story.** ONS publishes UK inflation 3–9 months ahead of the World Bank or IMF. The resolver's freshness primitive picks ONS without any schema change — `civicaRole='canonical'` is editorial metadata, not a resolver input. The methodology resolution for ONS-UK explicitly chose "freshness alone implements the NSO override" rather than introducing an NSO priority tier. The same pattern applies to all six NSOs in v1: US Census, ONS-UK, INSEE-FR, Statistics Canada, IBGE-BR, and Stats SA. CPI as a separate ONS measure is deferred to v1.1 with a future `inflation_rate_cpi` fact-key extension; for v1, only CPIH ships.

### Worked example 5 — South Africa unemployment, PDF-extraction NSO

**Pattern.** Novel ingest pattern — PDF extraction via the Anthropic SDK's native PDF support. Stats SA has no API; its data ships as monthly and quarterly PDF releases at stable URLs. The methodology is "scrape with a deterministic LLM call, not a regex."

**Frozen example rows.** Stats SA reports 31.4% (Q4 2025, with `as_of=2025-12-31`) from the LU1 row of Quarterly Labour Force Survey Table A. The World Bank reports 32.39% (2025). ILO ILOSTAT reports 32.59% (2027, tagged as an ILOEST nowcast projection — excluded from the candidate pool). The IMF reports 31.9% (2031, projected). The CIA reports 33.2% (2024, frozen). Wikidata holds an older 27.2% (2018) claim.

**Resolver outcome.** Stats SA's 31.4% (Q4 2025) wins canonical with `decisionReason='fresher_winner'`.

**Story.** Stats SA publishes the Quarterly Labour Force Survey (P0211) as a 5 MB PDF at a stable URL pattern. The R.19 sync uses a Claude Haiku call with `temperature: 0` to extract Table A's LU1 row deterministically, with the prompt structured as a tool-use call so the output JSON is shape-stable. There is no `pdftotext` binary available in the deployment runtime, no `pdf-parse` dependency added, and no fragile regex against template-rejigs at the publisher. The cost is roughly $0.01 per quarterly sync. The same pattern applies to inflation (P0141) and quarterly GDP growth (P0441). The pattern is reusable for any future NSO whose primary release surface is PDF rather than a machine-readable API.

### Worked example 6 — IMF projection vs measurement

**Pattern.** The `value_type` partition. IMF WEO ships forward projections through the current year + 5 years. The resolver requires the canonical pick to be a measurement whenever any measurement exists for the same (jurisdiction, fact-key) pair. Projections only win canonical when no measurement exists (e.g., `fiscal_balance_pct_gdp` for IMF-only countries).

**Frozen example rows for Argentina population_total.** The CIA reports 45,418,096 with a `(2025 est.)` stamp — a current-year nowcast, so its `data_vintage_year` normalizes to 2024 (see "CIA vintage stamps" below). The World Bank reports 45,696,160 (2024, measured). UN WPP reports 45,696,160 (2024, measured — bit-exact match to the World Bank because the World Bank republishes UN WPP). The IMF reports 50,394,000 (2031, projected). Wikidata holds an older 44,938,712 (2019, measured) claim.

**Resolver outcome.** Two partitions decide this fact. First, the IMF's 50.4 M (2031 projection) is excluded from the candidate pool by the measurement-vs-projection partition; it surfaces in the alternates panel labelled *(projected)*. Second, among the surviving measurements the CIA's `(2025 est.)` nowcast is aged to its 2024 measurement vintage, so it no longer outranks the UN WPP 2024 reading it was derived from. UN WPP's 45,696,160 (2024) wins canonical with `decisionReason='fresher_winner'` (the World Bank republishes the identical value); the CIA reading moves to the alternates panel with its published `(2025 est.)` stamp intact.

**Story.** An explicit `value_type` enum on `country_facts` (`measured` | `projected`) prevents a future-dated forecast from outranking a current measurement. IMF sync classifies rows with a year-based discriminator: `fact_year > current_year → projected`. The resolver's candidate pool filters to `value_type='measured'` first; IMF projections appear in the alternates panel with a projection flag. The underlying methodology is documented further in the "Measurement vs projection" section below.

### Worked example 7 — Brazil population, six publishers, IBGE override

**Pattern.** NSO override layered over multi-publisher disagreement that is methodologically real, not an error.

**Frozen example rows.** IBGE reports 213,421,040 (2025), tagged `civicaRole='canonical'` for Brazil. The CIA reports 221,359,387 (2025, frozen). The World Bank reports 211,998,573 (2024). UN WPP reports 211,998,573 (2024, bit-exact match — World Bank republishes UN). The IMF reports 216,988,990 (2031, projected). Wikidata holds an older 203,062,512 (2022) claim.

**Resolver outcome.** IBGE's 213.4 M (2025) wins canonical with `decisionReason='fresher_winner'`. The CIA's 221.4 M (2025) is the second-place alternate.

**Story.** Brazil is the showcase reconciliation case: the same fact has six values from five publishers, all at different vintages and using slightly different methodology. IBGE wins canonical because it is the freshest measurement from the country's own statistical office. The CIA's 221.4 M (2025) is a CIA Factbook 2025 projection that diverges from IBGE's 213.4 M actual estimate by about 3.7%, reflecting different underlying demographic models. UN/WB's 211.99 M (2024) is one year older. The IMF's 216.99 M (2031) is a forecast. The alternates panel shows all six rows labelled by methodology, vintage, and source role.

### Worked example 8 — Marshall Islands population, dispute resolved (only the losing row demoted)

**Pattern.** The disputes system, correctly resolved. A material-error gap — about 118% between the CIA's value and the World Bank's — was raised as a dispute rather than silently averaged, because the disagreement reflects a genuine definitional split, not a typo. A reviewer adjudicated the pair; resolving a dispute demotes only the *losing* row, leaving every other source active in the alternates panel.

**Frozen example rows.** The CIA reports 82,011 with a `(2024 est.)` stamp. The World Bank reports 37,548 (2024). UN WPP reports 37,548 (2024, bit-exact match). The IMF reports 33,000 (2031, projected). Wikidata holds an older 53,127 (2017) claim. The reviewer resolved the dispute in favour of the resident-population figure, so the CIA row — the losing party — is demoted (`status='demoted'`); the other four sources stay active.

**Resolver outcome.** With the CIA outlier out of the candidate pool, the resolver picks canonical over the survivors: UN WPP and the World Bank both report 37,548 (2024, the reviewer's value), so the incumbent UN WPP measurement holds via `decisionReason='incumbent_held'` and the fact is no longer flagged `(disputed)`. The CIA's 82,011 stays demoted — recorded for the provenance trail, but excluded from the pick; the IMF projection and the older Wikidata claim remain visible as alternates. The disputes log is at [/country/methodology/reconciliation/disputes](https://civicaatlas.org/country/methodology/reconciliation/disputes).

**Story.** The gap is a genuine multi-source disagreement, not a data-entry mistake. The CIA's 82,011 follows an accounting that counts the large Marshallese diaspora holding permanent right of residency under the Compact of Free Association with the United States; the World Bank and UN's 37,548 follows resident-population accounting. Both methodologies are defensible, which is why the disagreement surfaced as a dispute in the first place rather than being averaged away. Resolving it removes only the value the reviewer rejected and preserves the rest of the source set — including the CIA reading, demoted rather than deleted — so the full provenance trail stays inspectable.

---

## Measurement vs projection

Some publishers — most prominently the IMF World Economic Outlook and the ILO ILOEST nowcasts — ship rows whose `as_of` date is in the future, because the row is a forward projection rather than a historical measurement. The resolver requires the canonical pick to be a measurement whenever any measurement exists for the same (jurisdiction, fact-key) pair, by tagging every row with an explicit `value_type` enum (`measured` | `projected`) and partitioning the candidate pool to `measured` first. Projections only win canonical as a fallback (the IMF's `fiscal_balance_pct_gdp` for countries with no alternate publisher is the canonical singleton case). The methodology is documented in detail in the internal forecast-vs-measurement resolution document; the implementation pins the year-based discriminator (`fact_year > current_year → projected`) at sync time per publisher.

Because of this partition, the alternates panel always shows the IMF projection alongside the canonical measurement, labelled with a projection flag. Worked Example 6 above (Argentina population) is the canonical illustration.

---

## Multi-canonical with scope predicate

Sometimes two or three publishers are designated canonical for the same fact-key at different scopes. Eurostat is canonical for EU-27 + EFTA-4 jurisdictions on specified macroeconomic indicators; the IMF is canonical globally. ONS-UK is canonical for the United Kingdom; the World Bank is canonical globally. IBGE is canonical for Brazil; the IMF and World Bank stay canonical globally. Civica records those editorial scope rules with a per-row `civicaRole` tag and jurisdiction predicate, rather than forcing one publisher to alternate for every use.

The pattern matters because the alternates panel will sometimes show two or three rows tagged *canonical*, each labelled with its scope. A reader inspecting Germany's GDP growth sees Eurostat tagged canonical (EU+EFTA), the World Bank tagged canonical (global), and the IMF row tagged as a projection. None of this requires resolver schema changes — the resolver itself remains a freshness-driven engine; the editorial role tags are layered metadata that the alternates panel surfaces.

The pattern was first surfaced by OECD's member-only scope on `public_debt_pct_gdp`, then formalised by the Eurostat resolution which named the "multi-canonical with scope predicate" primitive, then extended by NSO Wave 1 which applied the same pattern to country-singleton scopes. Worked Example 4 (UK inflation) above is the canonical illustration.

---

## Two-fact-key splits

A different methodology question arises when two publishers measure *different things* under similar names. When this happens, Civica declares two distinct fact-keys rather than forcing one to alternate.

The first established case is trade aggregates. The World Trade Organization publishes `exports_merchandise_usd` — goods crossing borders, no services. The World Bank publishes `exports_goods_services_usd` — goods plus commercial services. For the United States in 2024, the WTO figure is about $2.06 trillion and the World Bank figure is about $3.19 trillion — a $1.1 trillion gap that exactly matches the missing services component. The two numbers are not "approximately the same exports figure with different vintages"; they are exports and exports-plus-services. The methodologically correct answer is that both are displayed, clearly labelled, side by side. The same split applies to imports.

A second case is queued for v1.1: ONS-UK's Public-Sector Net Debt (PSND, the UK statistical concept) versus the IMF's General-Government Gross Debt (Maastricht-style). ONS's PSND excludes public-sector banks and applies UK-specific accounting; the IMF measure applies harmonised international accounting. Forcing them into a single `public_debt_pct_gdp` fact-key would mix incommensurable measures. The v1.1 split will declare them as siblings under separate fact-keys.

The shape mirrors what reference institutions like Our World in Data already do: when two upstream publishers measure genuinely different things, surface both with honest labels.

---

## Vintaging

Each `country_facts` row carries the upstream measurement date (`as_of`), our retrieval date, and the upstream dataset version where known (e.g. `World Bank WDI 2026Q3`, `CIA Factbook 2026-01-frozen`, `IMF WEO 2026 April`, `ONS UK 2026Q2`, `IBGE SIDRA 2026Q2`, `Stats SA 2026Q2`). On top of those per-row upstream vintages, Civica freezes a quarterly **reconciled-fact vintage** — a snapshot of the resolver's output for every country and fact at the cut moment. The cadence is **15 days after each calendar quarter end**: 15 January, 15 April, 15 July, 15 October at 04:00 UTC. The T+15 day buffer gives publishers with quarter-end releases time to finish their normal cadence before the cut.

The vintage label format is:

`Civica Atlas Reconciled v<methodology_version> — vintage <YYYY-Qn>`

The first frozen v1 vintage is **`Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1`**, cut on 5 May 2026. It records the resolver state at that cut. The methodology version is embedded in the label so any cited vintage value carries the rules that produced it. When methodology revises to `v0.3-beta`, the next vintage label embeds that version, and the v0.2-beta vintages remain stable as historical citations.

Pinning a citation to a specific vintage gives the reader a value that does not move. If the upstream World Bank revises a 2024 GDP figure six months later, that revision lands in a new vintage; the prior snapshot is unchanged. Civica stores vintages uniformly, while displays can filter quarters where nothing materially changed so readers do not need to scroll past silent vintages.

---

## How to read a SourceDot

Every reconciled fact on the site carries a small dot to the right of the value. The dot colour signals freshness:

- **Green dot.** The upstream source still updates and our last sync succeeded. The hover tooltip shows the source name, license, and the measurement date.
- **Amber dot.** The upstream source is frozen (the CIA Factbook after January 2026, for example) or our sync has not refreshed within the expected cadence.
- **Disputed chip.** A small `(disputed)` chip appears next to the dot when the fact has an open dispute. The fact continues to render its prior canonical value while the dispute is open.

Click the dot (or the small `+` affordance next to it) to open the alternate-values panel. The panel lists every source row Civica holds for that fact, with the canonical row highlighted, the rejected rows shown with the reason, the measurement date for each row, the editorial role tag (*canonical*, *alternate*, or *projection*), and a direct link to the upstream reference. The panel header carries the methodology version. When a dispute is open, the panel surfaces a banner naming the contested rows.

On factbook reader pages, multi-year series (inflation, public debt, GDP variants, unemployment, military expenditure, current-account balance, exports, imports) get a "Civica canonical (reconciled)" row prepended above the CIA's per-year prose. The CIA's historical context is preserved; the reconciled current canonical sits at the top.

---

## Editorial canonical vs displayed value

Sometimes the source Civica regards as the editorial authority for a fact is not the source whose number ends up on the country page. This is intentional. Civica separates two questions:

- **Who measured this?** The editorial canonical — the publisher Civica designates for the fact and documented scope. For health facts like life expectancy and infant mortality, that is the World Health Organization (WHO). For trade (merchandise), the World Trade Organization. For unemployment, the International Labour Organization. For literacy, UNESCO. For HDI, UNDP. Civica records this editorial rule as a tag (`civicaRole: "canonical"`) on the source row.
- **What's the most recent measurement?** The displayed value — the freshest within-envelope row from any allow-listed source. The resolver picks this by date. The alternates panel surfaces the editorial canonical alongside, clearly labelled.

When the editorial canonical happens to also be the freshest source, both questions resolve to the same row and there is nothing to explain. But canonical publishers often release on slow cycles — the UN Population Division refreshes its World Population Prospects dataset every two years, and the WHO GHO ships life-expectancy on a similar slow cadence. While that cycle runs, fresher data from the CIA, the World Bank, or an NSO may sit on the same fact and win on freshness. The country page shows the freshest value; the alternates panel shows the editorial canonical alongside. Worked Example 2 above (United States life expectancy, where UN WPP's 77.05 (2024) wins display while WHO's 76.37 (2021) is editorially canonical) is the textbook case.

The frozen 2026-Q1 example shows the same pattern on Brazil's population. At that cut, Civica held six values for that fact, each from a different publisher, each with a different measurement date: IBGE 213,421,040 (2025) — the NSO winner; the CIA 221,359,387 (2025); the World Bank 211,998,573 (2024); UN WPP 211,998,573 (2024, bit-exact match); the IMF 216,988,990 (2031, projected); Wikidata 203,062,512 (2022). UN is the editorial canonical for population because nearly every other source — including the World Bank — derives its number from UN WPP. IBGE wins on freshness in 2025 because the country's own statistical office publishes ahead of UN's biennial revision. When UN ships the next WPP revision, the canonical pick will move back to UN automatically — no methodology change needed.

This is not a contradiction. It is how Civica balances two honest answers to two different questions: *who measured this*, and *what's the most recent measurement*. A reader who sees an NSO value on the country page and a UN or WHO label on the alternates panel is seeing the system working as designed.

---

## Canonical-flip handoffs and shared canonical publishers

Two refinements of the editorial-canonical convention are worth surfacing here so a reader who notices the unusual pattern in the alternates panel can understand why.

**Canonical-flip handoffs.** When Civica adds a new sync orchestrator that ingests data directly from an upstream-of-record publisher, fact-keys previously sourced from a downstream republisher get their editorial role flipped — the upstream publisher becomes canonical, the republisher becomes alternate. The values do not change; only the citation label moves.

The flagship example: in early 2026, Civica ingested mean and expected years of schooling from the UN Development Programme's Human Development Report. UNDP HDR was tagged canonical because it was the only Tier-1 source Civica ingested for those two indicators. The fact-key registry expansion later added a direct UNESCO Institute for Statistics sync for the same indicators. UNESCO is the upstream-of-record — UNDP republishes UNESCO's figures as inputs to the HDI composite. The editorial canonical flipped to UNESCO; UNDP rows in `country_facts` were re-written on the next idempotent sync with the alternate label. Same values, same citation count, more accurate attribution.

**Shared canonical publishers.** A small number of fact-keys are computed by two independent Tier-1 publishers using the same joint methodology. When this happens, both publishers ship as canonical — neither is the "true" upstream.

The first such case landed at `health_expenditure_pct_gdp`: the WHO Global Health Expenditure Database (broad global coverage) and the OECD System of Health Accounts (OECD members and participating SHA partners) both apply the SHA-2011 methodology jointly developed by WHO, OECD, and Eurostat. Their numerators (current health expenditure summed across all financing schemes) and denominators (GDP at market prices) come from the same primary national health-account submissions; values converge to within ~0.1 percentage points and the small remaining noise reflects GDP-revision pickup timing rather than real methodological disagreement. The resolver picks the fresher row within envelope; the alternates panel renders both as editorial canonical for their respective coverage scopes.

A reader who sees two canonical labels next to one fact is looking at the second pattern. A reader who sees a UNESCO canonical label on a row that used to cite UNDP is looking at the first. These patterns are distinct from the multi-canonical-with-scope-predicate pattern documented above (where two publishers are canonical for the same fact-key in different scopes); here the two publishers are jointly methodologically responsible for the measurement itself.

---

## Disputes

A dispute row is opened automatically when a numeric disagreement exceeds the material-error guard, when a Group A or Group C silent-override would have been required, when a claim is rejected per the plausibility envelope, or when a Wikidata claim flips from non-deprecated to deprecated rank for an existing canonical value.

The full dispute log is published as a public read-only surface at [/country/methodology/reconciliation/disputes](https://civicaatlas.org/country/methodology/reconciliation/disputes) — every open dispute, every resolved dispute, the system actions taken on each, and the methodology rationale where one was recorded. Reviewer identity is redacted; submitter PII is stripped. The Marshall Islands population case (Worked Example 8 above) is a live entry in that log.

Readers can also file a dispute manually. The unified corrections form at [/civica-index/corrections](https://civicaatlas.org/civica-index/corrections) accepts factbook fact disputes; per-fact "report this fact" links pre-fill the country and fact key for you, which substantially improves submission quality. Each submission becomes a row in the operator queue.

Operators review through an admin shell. They see both values, both citations, both measurement dates, a diff highlight, the resolver's proposed action and rationale, and three buttons: accept the proposal, override and pick a specific source, or hold for further investigation. Every action writes to an audit log with before-and-after JSON snapshots, the reviewer's identity, the action, and any notes.

A daily auto-resolve cron at 02:30 UTC re-evaluates every open `material_error` dispute against the current resolver output. If the resolver no longer proposes the dispute because the governing threshold or underlying values no longer produce a conflict, the cron marks it `resolved_auto_stale` with an audit-log row. Group A, Group C, and plausibility-envelope disputes are *never* auto-resolved — identity and categorical conflicts always require human eyes.

Resolution targets — these are targets, not gates; the fact continues to render the prior canonical value while the dispute is open:

- Numeric disagreements with both sources Tier-1 — 14 days.
- Group A identity overrides — 7 days.
- Group C breakdown overrides — 30 days.
- Plausibility-envelope rejections (likely data corruption) — 24 hours, since these are usually pipeline bugs rather than data questions.

---

## Replication

The resolver is a pure function. Given a fixed snapshot of the inputs, it produces the same output every time. A third party should be able to reproduce any vintage's values from public artefacts.

The deterministic inputs are:

- The git-tagged schema (DDL for the country-facts and related tables).
- The source allowlist file at the same git tag — `src/lib/factbook/reconcile/source-allowlist.ts`. The allowlist is immutable per methodology version; the git history is its change log.
- The sync scripts that populate the source rows — for the CIA file, for Wikidata via the SPARQL query interface, for each multilateral agency adapter, and for each NSO adapter.
- The resolver itself, at the same git tag — `src/lib/factbook/reconcile/resolver.ts`.
- The vintage snapshot script and cron route that write the quarterly vintage rows.
- The upstream payload archive — every Wikidata, World Bank, IMF, NSO, and other adapter response is hashed and stored alongside the country-facts rows. Snapshot artefacts make a vintage replayable even if upstream values later change.

Crucially, the resolver does not call a language model. Fact reconciliation is rule-based — that is the entire point of the design. A language model can summarise a dispute for an operator, and a deterministic LLM call is used at sync time for the Stats SA PDF-extraction case (Worked Example 5 above), but the canonical resolver output is deterministic boolean and numeric logic only.

A full replication recipe — including SQL snapshots and a worked walk-through that re-derives a vintage's values from the artefacts — is on the v1.1 roadmap as a future page at `/country/methodology/reconciliation/replication` (not yet shipped). For the present, the inputs above are load-bearing in their git-tagged form, and an external reviewer with access to the repository can replay the v0.2-beta vintage 2026-Q1 cut by running the sync scripts against the archived payloads and the snapshot script against the resulting rows.

---

## Version policy and the perpetual-beta posture

Civica maintains versioned working records for load-bearing methodology calls (peer grouping, the forecast-vs-measurement partition, the trade-aggregate two-fact-key split, the canonical-pick material-error thresholds, and the vintage cadence framework). These records improve internal auditability but have not all been published or independently reviewed.

The methodology version stamp stays in beta indefinitely. Version bumps (`v0.2-beta` → `v0.3-beta` → `v0.4-beta`) signal a methodology refinement; they do not signal a graduation event. Civica's posture is that the reconciliation rules will continue to refine as new publishers ship, new fact-keys are added, and external reviewers contribute feedback. There is no calendar gate at which the methodology stops being beta.

What this does *not* mean: vintaged data is not unstable. The vintage label embeds the methodology version, so a reader citing `Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1` gets a value that does not move and is unambiguously tied to the v0.2-beta rules. When methodology revises to v0.3-beta, the new vintage label carries the new version; the v0.2-beta vintages remain as stable historical citations.

External review is an explicit project goal, not a hypothetical. The [contact form](https://civicaatlas.org/contact) is the route in for reviewers — data-quality specialists, statistical agency staff, computational journalists, comparative politics scholars. The methodology version will bump when reviewer feedback is incorporated; the audit trail in the resolution document corpus tracks the reasoning.

The methodology resolution corpus is currently held as working documents, available to academic reviewers on request. Public publication of a curated subset is on the v1.x roadmap. The [methodology hub](https://civicaatlas.org/methodology) indexes the published methodology pages and summarises the unpublished corpus.

---

## Citing this methodology

Three citation forms cover the common cases. Every form embeds the methodology version stamp, so a reader citing any vintage value gets a stable reference even after future methodology revisions.

### Citing the methodology page itself

*Civica Atlas Reconciliation Methodology v0.2-beta. Civica Atlas, 2026. [https://civicaatlas.org/country/methodology/reconciliation](https://civicaatlas.org/country/methodology/reconciliation). Retrieved [date].*

### Citing a single reconciled fact

*Civica Atlas (2026). [Country] [fact], vintage Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1. Sourced from [primary publisher]. Methodology v0.2-beta.*

Worked example, the Argentina inflation case (Worked Example 1 above):

*Civica Atlas (2026). Argentina inflation rate, vintage Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1. Sourced from World Bank World Development Indicators 2026Q3 (2024 reading: 219.88%). Methodology v0.2-beta.*

### Citing a frozen vintage of the entire reconciled atlas

*Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1. Civica Atlas, 2026. [https://civicaatlas.org/country/methodology/reconciliation](https://civicaatlas.org/country/methodology/reconciliation). Cut date: 5 May 2026. Methodology version v0.2-beta.*

The interactive `<CiteAccordion>` widget on the live page generates APA, BibTeX, and Chicago citations for this page in one click, each stamped with the reconciled vintage's cut date as the data date.

---

*Related pages: [Methodology hub](https://civicaatlas.org/methodology) · [How we approach data](https://civicaatlas.org/methodology/approach) · [Country atlas](https://civicaatlas.org/country) · [Disputes log](https://civicaatlas.org/country/methodology/reconciliation/disputes) · [Civica Index methodology](https://civicaatlas.org/civica-index/methodology) · [Pulse methodology](https://civicaatlas.org/civica-index/methodology/pulse) · [Corrections form](https://civicaatlas.org/civica-index/corrections)*
