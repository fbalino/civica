# Factbook Reconciliation

<!-- Source: src/app/(reader)/factbook/methodology/reconciliation/page.tsx · Extracted 2026-05-04 -->

*How Civica picks one canonical value per country fact when multiple sources disagree, and how readers can audit the choice. Methodology v0.1 — under active development.*

*Version v0.1 (Beta) · Published 2026-05-02*

> **This methodology is in Beta.** The resolver rules, source allowlist, and vintage cadence may change before v1.0. Quarterly vintages still freeze, so a citation pinned to a specific vintage (for example, `Civica Atlas 2026Q3`) is stable; the rules that produced it are the part still under review. See the Beta status section below for graduation criteria.

---

## What this is

Civica's factbook draws on multiple sources for the same underlying fact. The CIA World Factbook is comprehensive but stopped updating in January 2026. Wikidata is fresh but its claims vary in quality. Multilateral statistical agencies (the World Bank, IMF, UN) are authoritative but cover narrower fact sets. For any given country and fact — Nigeria's population, France's capital, Brazil's GDP — Civica may hold two, three, or four candidate values from different sources, each with its own measurement date and reference chain.

The reconciliation layer is the rule-based system that picks one value to display, preserves the rest for transparency, and escalates disagreements that look like data errors or contested changes. The rules are deterministic: no language model, no confidence scores, no convergence loops. A third party with our inputs and the source allowlist must be able to reproduce the choice.

---

## Scope

We classify each fact into one of three groups by an explicit per-fact-key decision, not at runtime. The group determines how the resolver weights freshness against authority.

### Group A — Slow-changing identity facts

These facts barely move from year to year. Wording matters and readers cite them by name.

- Examples: capital, official short and long names, ISO 2/3 codes, currency code, official languages, total area in square kilometres, time zones, internet TLD, calling code.
- **Default:** CIA wording wins. Wikidata can override only when CIA is empty and the Wikidata claim has a Tier 1 or Tier 2 reference. Any silent override of a non-empty CIA value is a bug — the dispute path is the only way through.

### Group B — Fast-changing quantitative facts

These are the figures most likely to be stale on the frozen CIA file. Freshness is the priority.

- Examples: population, GDP nominal and PPP, GDP per capita, GDP growth, inflation, public debt as % of GDP, unemployment, life expectancy, electricity generation by source, internet users, CO2 emissions.
- **Default:** the fresher allow-listed source wins, subject to a material-error guard and a reference-quality floor. CIA is preserved as an alternate even when superseded.

### Group C — Categorical and structural facts

These age slowly and Wikidata's reference graph is thinnest here.

- Examples: government type (raw CIA string), chief of state title, electoral system, suffrage age, legal system family, religion breakdown, ethnic group breakdown, climate type, terrain summary, natural resources, land use breakdown.
- **Default:** CIA wins, full stop. The exception is census-derived breakdowns (religion, ethnicity) where a recent national census from an allow-listed national statistical office crosses a defined threshold; that triggers a dispute, never a silent swap.

### Out of scope

The reconciliation layer does not govern judgment claims — regime classification, human rights status, contested geopolitical labels, "is X a democracy." Each of these has a named primary source with its own published ingestion path: [Civica Index](https://civicaatlas.org/civica-index/methodology) dimension scores (V-Dem, Freedom House, World Bank WGI, UNDP HDI, Transparency CPI, Global Peace Index), [Civica Pulse](https://civicaatlas.org/civica-index/methodology/pulse) events, the Bjornskov-Rode / CGV regime taxonomy, and constitutional text from the Constitute Project. Officeholders (heads of state, heads of government) and party seat counts are also out of scope — they have purpose-built sync paths that predate Phase F.

### Country coverage policy

Civica covers all 193 UN member states as sovereign jurisdictions, plus the 2 UN observer states (the Holy See and Palestine), plus partially-recognized entities that have a user-assigned ISO 3166-1 code AND are treated as distinct statistical units by the World Bank and IMF (Kosovo). This mirrors the country lists used by Our World in Data, the World Bank, the UN Statistical Division, UNDP, and V-Dem. Civica makes no editorial claim about any country's sovereignty or recognition status — the coverage floor is "what UN agencies and the World Bank treat as a country," not Civica's own judgment.

For Palestine, two parallel records exist: territory-level CIA Factbook entries for the West Bank and Gaza Strip (preserving the Factbook's separate prose for each territory) sit alongside a unified `PSE` row that acts as the iso3-keyed reconciliation target for World Bank, IMF, WHO, UNDP, UNESCO, and V-Dem data. Kosovo is included under the user-assigned ISO code `XKX`, following World Bank, IMF, and UNDP practice. Western Sahara, Hong Kong, and other CIA Factbook territory entries remain in the database with their Factbook content but without iso3 codes — they receive only Civica's CIA Factbook treatment because Tier-1 publishers do not write separate rows for them.

---

## Sources

A Wikidata claim is accepted only if its references — via the `P248` "stated in" property or the `P854` reference URL — point to an entry on the allowlist. Allowlist entries are organised in four tiers; the full list lives in [`src/lib/factbook/reconcile/source-allowlist.ts`](https://github.com/civicaatlas/civica/blob/main/src/lib/factbook/reconcile/source-allowlist.ts) and is the single source of truth — both the schema and the resolver import from it.

### Tier 1 — Multilateral statistical agencies

- [World Bank Open Data](https://data.worldbank.org)
- [International Monetary Fund](https://www.imf.org) (WEO, IFS)
- [United Nations Statistics Division](https://unstats.un.org)
- [UNDP Human Development Reports](https://hdr.undp.org)
- [WHO Global Health Observatory](https://www.who.int/data/gho)
- [UNESCO Institute for Statistics](https://uis.unesco.org)
- [OECD.Stat](https://stats.oecd.org)
- [FAO FAOSTAT](https://www.fao.org/faostat)
- [ILO ILOSTAT](https://ilostat.ilo.org)
- [Eurostat](https://ec.europa.eu/eurostat)
- [WTO Stats](https://stats.wto.org)

### Tier 2 — Curated national statistical offices

A curated set of roughly 30–40 NSO domains known to be stable, machine-readable, and English-friendly: US Census Bureau, ONS-UK, INSEE-FR, Destatis-DE, Statistics Canada, IBGE-BR, Stats SA, NBS-Nigeria, and others. We add NSOs to the list on demand — when a fact-key for a specific country has no Tier 1 coverage and an NSO is its authoritative source. Every addition triggers a methodology version bump.

### Tier 3 — CIA World Factbook

The CIA file is public-domain and remains the default for identity facts (Group A) and categorical facts (Group C), regardless of what Wikidata claims. It is treated as frozen-as-of January 2026.

### Tier 4 — Wikidata as a structured pipe

A Wikidata claim is never "self-citing" for our purposes. What we trust is the Tier 1 or Tier 2 source the claim points at; Wikidata is the structured query path. A Wikidata claim with no allow-listed reference is rejected at sync time and never enters the canonical store.

### Explicitly rejected references

Wikidata claims whose only references are imported-from-Wikipedia (`P143`), Wikipedia itself, generic news aggregators (Worldometers, Statista's free tier), personal blogs, social media, self-published advocacy NGO claims for facts they are not the primary source of, or a Wikidata mirror of CIA Factbook (we want the primary CIA file directly). A claim with multiple references is accepted if at least one reference is on the allowlist; a majority is not required.

---

## The resolver

Given a country and a fact key, the resolver returns one canonical value plus the full list of alternates. Rules are evaluated in order. If only one source row exists for a fact, that value is used. Otherwise the rules below apply by group.

For Groups A and C, when sources agree within tolerance (within 2% for counts, within 0.5 percentage points for rates, exact match for strings after Unicode normalisation), CIA is preferred when present. For Group B the resolver does not short-circuit on agreement — even when CIA and a fresher source agree within tolerance, the fresher allow-listed source wins and CIA is preserved as an alternate. This is because freshness is the whole point for fast-changing facts.

When sources disagree, two guards apply for Group B:

- **Material-error rejection.** A fresher value differing from the older one by more than a per-category "impossible" threshold (population > 50% in a year, GDP nominal in USD > 80%, rate facts flipping outside [-1%, +101%]) is rejected as likely data corruption or a unit-of-measure error. A dispute row is created and the prior canonical value remains until reviewed.
- **Reference-quality floor.** The fresher source must have at least one Tier 1 or Tier 2 reference. A Wikidata claim whose references are all rejected per the allowlist cannot win even if it is fresher.

The five worked examples below are normative — they are the fixtures the resolver tests use.

---

**Nigeria population — Group B, fresher source wins**

**Situation.** CIA reports 230,842,743 (2023 estimate). Wikidata reports 226,683,440 (2024) citing the World Bank. The World Bank itself reports the same 2024 value directly.

**Resolver.** Fast-changing fact, sources disagree by under 2%. Both guards pass: 2% disagreement is inside the material-error threshold; 2024 is newer than 2023; the World Bank reference is Tier 1. World Bank wins. CIA stays in the country-facts store and renders in the alternate-values panel.

**Why.** For Group B, freshness is the tie-breaker. The reader sees the most current measurement and the older CIA estimate one click away.

---

**Nigeria capital — Group A, agreement**

**Situation.** CIA: "Abuja." Wikidata: "Abuja," cited to the Federal Government of Nigeria (Tier 2).

**Resolver.** Identity fact, exact match after Unicode normalisation. CIA wins by Group A default. Both citations are surfaced in the alternate-values panel.

**Why.** Identity facts default to CIA wording because it is public-domain and citable; Wikidata's stylebook varies by editor. Agreement plus a Tier 2 backing citation makes both rows worth showing.

---

**Nigeria official languages — Group A, CIA default with rejected reference**

**Situation.** CIA: "English (official)." Wikidata: English with *preferred* rank, plus Hausa, Yoruba, Igbo with *normal* rank, all referenced to the Constitution of Nigeria via Wikisource. Wikisource is not on the allowlist.

**Resolver.** CIA is non-empty so CIA wins by Group A default. The Wikisource reference is rejected. The Wikidata claim is recorded but not surfaced as canonical, and no dispute is opened — the CIA value already covers the ground.

**Why.** A non-empty CIA Group A value is never silently overridden. The Wikidata claim's references would need at least one Tier 1 or Tier 2 entry for the override path to even open.

---

**Nigeria GDP nominal — Group B, material-error catch**

**Situation.** CIA: $440B (2024 estimate). Wikidata: $4,400B (2024) — a unit-of-measure data corruption where billions was written as trillions upstream.

**Resolver.** The disagreement is 10×, far beyond the 80% material-error threshold for GDP nominal. The fresher value is rejected at sync time, a dispute row is opened, and the prior canonical value (CIA) continues to render. An operator reviews, confirms data corruption, and marks the dispute resolved with a corrected note.

**Why.** The material-error guard exists to catch unit-of-measure errors and copy-paste corruption before they reach readers. Disputes are visible publicly so the catch is itself audit-able.

---

**Vatican religion breakdown — Group C, CIA default**

**Situation.** CIA: "Roman Catholic 100%." Wikidata: "Catholic 99%, Other 1%."

**Resolver.** Group C, so CIA wins regardless of disagreement size. Wikidata is recorded for transparency and surfaces in the alternate-values panel. No dispute — the 1% delta is editorial colour rather than a meaningful disagreement, and the threshold for opening a Group C breakdown dispute is a 5-percentage-point line item.

**Why.** Group C is the zone where Wikidata edits most often encode interpretation rather than fact. Better to be slightly stale than to silently surface a contested edit.

---

## Vintaging

Each country-facts row carries the upstream measurement date (`as_of`), our retrieval date, and the upstream dataset version where known (e.g. `WB WDI 2026.04`, `CIA Factbook 2026-01-frozen`). On top of those per-row vintages, Civica freezes a quarterly **reconciled-fact vintage** — a snapshot of the resolver's output for every country and fact at quarter end. The cadence mirrors the Civica Index.

Pinning a citation to a specific vintage gives the reader a value that will not move. If the upstream World Bank revises a 2024 GDP figure six months later, that revision lands in a new vintage; the prior snapshot is unchanged. A representative citation looks like this:

*Civica Atlas, Nigeria population, vintage 2026Q3 → 244,344,060 (CIA Factbook 2026-01-frozen, retrieved 2026-05-02).*

The changelog page filters vintages so quarters where nothing materially changed are not shown — readers do not need to scroll past silent vintages. Non-filtered storage is uniform; only the display is filtered.

---

## How to read a SourceDot

Every reconciled fact on the site carries a small dot to its right. The dot colour signals freshness:

- **Green dot.** The upstream source still updates and our last sync succeeded. The hover tooltip shows the source name, license, and the measurement date.
- **Amber dot.** The upstream source is frozen (the CIA Factbook after January 2026, for example) or our sync has not refreshed within the expected cadence.
- **Disputed chip.** A small `(disputed)` chip appears next to the dot when the fact has an open dispute. The fact continues to render its prior canonical value while the dispute is open.

Click any SourceDot to open the alternate-values panel. The panel lists every source row Civica holds for that fact, with the canonical row highlighted, the rejected rows shown with the reason, the measurement date for each row, and a direct link to the upstream reference. The panel header carries the methodology version. When a dispute is open, the panel opens by default with a banner naming the contested rows.

---

## Editorial canonical vs displayed value

Sometimes the source Civica regards as the editorial authority for a fact is not the source whose number ends up on the country page. This is intentional. Civica separates two questions:

- **Who measured this?** The editorial canonical — the publisher Civica trusts as the authoritative reference for the fact. For health facts like life expectancy and infant mortality, that is the World Health Organization (WHO). For trade, the World Trade Organization. For unemployment, the International Labour Organization. Civica records this as a tag (`civicaRole: "canonical"`) on the source row.
- **What's the most recent measurement?** The displayed value — the freshest within-envelope row from any allow-listed source. The resolver picks this by date. The methodology page documents the rule elsewhere on this page (see "The resolver" section above).

When the editorial canonical happens to also be the freshest source, both questions resolve to the same row and there is nothing to explain. But canonical publishers often release on slow cycles — the UN Population Division, for example, refreshes its World Population Prospects dataset only every two years. While that cycle runs, fresher data from the CIA World Factbook may sit on the same fact and win on freshness. The country page shows the freshest value; the alternates panel shows the editorial canonical alongside, clearly labelled.

**Worked example: Brazil population.** Civica holds five values for this fact, each from a different publisher, each with a different measurement date:

- UN World Population Prospects (2024 Revision): **211,998,573 people** (2024) — *editorial canonical*
- World Bank Open Data: **211,998,573 people** (2024) — bit-exact match to UN, because the World Bank republishes UN WPP figures verbatim
- CIA World Factbook: **221,359,387 people** (2025 estimate) — currently displayed
- IMF World Economic Outlook: **216,989,000 people** (2031 forecast)
- Wikidata: **203,062,512 people** (2022)

The UN Population Division is the editorial canonical for population because nearly every other source — including the World Bank — derives its number from UN WPP. The World Bank's row matches UN's digit-for-digit because the World Bank literally republishes the UN figure. The CIA Factbook produces an independent forward estimate by extrapolating from UN's most recent published year, and ships that estimate one calendar year ahead of UN.

Civica's resolver picks the freshest within-envelope row, which here is CIA's 221.4 million (2025). The country page renders 221,359,387; the alternates panel shows UN 211,998,573 (2024) labelled as the editorial canonical, with World Bank, IMF, and Wikidata listed as the other alternates. When the UN publishes the 2026 Revision (expected mid-2026 with a 2025 reference year), the UN row will move back to the displayed slot automatically — no methodology change needed.

The 11-million difference between CIA 2025 and UN 2024 (~5 per cent) reflects a one-year forward projection plus differences in the demographic models the two organizations use. Both values sit inside Civica's plausibility envelope and below the material-error guard, so neither is rejected. The resolver simply picks the more recent of two admissible rows.

**Second worked example: United States life expectancy.** Same pattern, different domain. As of this writing four sources publish a value:

- WHO Global Health Observatory: 76.37 years (2021)
- World Bank: 78.89 years (2024)
- CIA World Factbook: 80.9 years (2024)
- Wikidata: 77.0 years (2022)

WHO is the editorial canonical for health statistics. The resolver picks the freshest within-envelope row, which is CIA 80.9 (2024). The country page renders 80.9; the alternates panel shows WHO 76.37 (2021) labelled as the editorial canonical, with WB and Wikidata as other alternates. When WHO ships a 2024 release, WHO will move back to the displayed slot automatically.

This is not a contradiction. It is how Civica balances two honest answers to two different questions: *who measured this*, and *what's the most recent measurement*. A reader who sees a CIA Factbook value on the country page and a UN or WHO label on this methodology page is seeing the system working as designed.

---

## Canonical-flip handoffs and shared canonical publishers

Two refinements of the editorial-canonical convention land in Phase R.7.5 (May 2026), both worth surfacing here so a reader who notices the unusual pattern in the alternates panel can understand why.

**Canonical-flip handoffs.** When Civica adds a new sync orchestrator that ingests data directly from an upstream-of-record publisher, fact-keys previously sourced from a downstream republisher get their editorial role flipped — the upstream publisher becomes canonical, the republisher becomes alternate. The values do not change; only the citation label moves.

The most recent example: in Phase R.6 (April 2026), Civica ingested mean and expected years of schooling from the UN Development Programme's Human Development Report. UNDP HDR was tagged canonical because it was the only Tier 1 source Civica ingested for those two indicators. Phase R.7.5 added a direct UNESCO Institute for Statistics sync for the same indicators. UNESCO is the upstream-of-record — UNDP republishes UNESCO's figures as inputs to the HDI composite. The editorial canonical flipped to UNESCO; UNDP rows in `country_facts` were re-written on the next idempotent sync with the alternate label. Same values, same citation count, more accurate attribution.

**Shared canonical publishers.** A small number of fact-keys are computed by two independent Tier 1 publishers using the same joint methodology. When this happens, both publishers ship as canonical — neither is the "true" upstream.

The first example landed at R.7.5: current health expenditure as a share of GDP, computed by both the WHO Global Health Expenditure Database (~190 countries) and the OECD System of Health Accounts (51 countries — 38 OECD members plus 13 SHA partners). Both apply the SHA-2011 methodology jointly developed by WHO, OECD, and Eurostat. Their numerators (current health expenditure summed across all financing schemes) and denominators (GDP at market prices) come from the same primary national health-account submissions; values converge to within ~0.1 percentage points and the small remaining noise reflects GDP-revision pickup timing rather than real methodological disagreement. The resolver picks the fresher row within envelope; the alternates panel renders both as editorial canonical for their respective coverage scopes.

A reader who sees two canonical labels next to one fact is looking at the second pattern. A reader who sees a UNESCO canonical label on a row that used to cite UNDP is looking at the first.

---

## Disputes

A dispute row is opened automatically when a numeric disagreement exceeds the material-error guard, when a Group A or Group C silent-override would have been required, when a claim is rejected per the plausibility envelope, or when a Wikidata claim flips from non-deprecated to deprecated rank for an existing canonical value.

Readers can also file a dispute manually. The unified corrections form at [/civica-index/corrections](https://civicaatlas.org/civica-index/corrections) accepts factbook fact disputes; per-fact "report this fact" links pre-fill the country and fact key for you, which substantially improves submission quality. Each submission becomes a row in the operator queue.

Operators review through the same shell as Pulse review. They see both values, both citations, both measurement dates, a diff highlight, the resolver's proposed action and rationale, and three buttons: accept the proposal, override and pick a specific source, or hold for further investigation. Every action writes to an audit log with before-and-after JSON snapshots, the reviewer's identity, the action, and any notes.

Resolution targets — these are targets, not gates; the fact continues to render the prior canonical value while the dispute is open:

- Numeric disagreements with both sources Tier 1 — 14 days.
- Group A identity overrides — 7 days.
- Group C breakdown overrides — 30 days.
- Plausibility-envelope rejections (likely data corruption) — 24 hours, since these are usually pipeline bugs rather than data questions.

---

## Replication

The resolver is a pure function. Given a fixed snapshot of the inputs, it produces the same output every time. A third party should be able to reproduce any vintage's values from public artefacts.

The deterministic inputs are:

- The git-tagged schema (DDL for the country-facts and related tables).
- The source allowlist file at the same git tag — `src/lib/factbook/reconcile/source-allowlist.ts`. The allowlist is immutable per methodology version; the git history is its change log.
- The sync scripts that populate the source rows — for the CIA file, for Wikidata via the SPARQL query interface, and for each multilateral agency adapter.
- The resolver itself, at the same git tag — `src/lib/factbook/reconcile/resolver.ts`.
- The vintage snapshot script that writes the quarterly vintage rows.
- The upstream payload archive — every Wikidata, World Bank, and IMF response is hashed and stored alongside the country-facts rows. Snapshot artefacts make a vintage replayable even if upstream values later change.

Crucially, the resolver does not call a language model. Fact reconciliation is rule-based — that is the entire point of the design. A language model can summarise a dispute for an operator, but the canonical resolver output is deterministic boolean and numeric logic only. The full replication recipe, including the SQL snapshots and a worked walk-through, is published at `/factbook/methodology/reconciliation/replication` (scaffold landing in F.5).

---

## Beta status and roadmap

The reconciliation layer ships behind a Beta pill. While the version stays at v0.x, the source allowlist, the resolver tie-break order, and the material-error and plausibility thresholds may change. The resolver embeds the methodology version on every country-facts row, so any vintage's data is tied to the rules that produced it.

v1.0 graduation requires:

- At least one external reviewer outside Civica with relevant expertise — data quality, statistical agencies, or computational journalism — and a public response to their feedback.
- At least three quarters of vintaged Beta data, so reviewers can audit drift between vintages.
- At least two documented disputes resolved end-to-end through the public queue.
- An interactive resolver demo at `/factbook/methodology/reconciliation/explore` and a read-only public disputes log at `/factbook/methodology/reconciliation/disputes`, both targeted for the F.7 graduation milestone.

v1.0 onward, allowlist changes are version-bumped (v1.1, v1.2, and so on); v2.0 indicates a methodology change so substantive that prior vintages are not directly comparable. Changes from v1.0 onward require Civica advisory-board sign-off.

---

## Citing this methodology

Recommended citation:

*Civica Atlas Reconciliation Methodology v0.1 (Beta), retrieved [date]. [https://civicaatlas.org/factbook/methodology/reconciliation](https://civicaatlas.org/factbook/methodology/reconciliation).*

When citing a specific reconciled fact, pin the vintage: "Civica Atlas, [country] [fact], vintage [YYYYQn]." The vintage is the part that does not move; the underlying methodology version is recorded alongside it for full reproducibility.

---

*Related pages: [Factbook](https://civicaatlas.org/factbook) · [Civica Index methodology](https://civicaatlas.org/civica-index/methodology) · [Pulse methodology](https://civicaatlas.org/civica-index/methodology/pulse) · [Changelog](https://civicaatlas.org/factbook/methodology/reconciliation/changelog) · [Corrections form](https://civicaatlas.org/civica-index/corrections)*
