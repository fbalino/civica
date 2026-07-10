<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is the
  prose source of truth for /civica-index/methodology/peer-grouping.
  The TSX shell at
  src/app/(reader)/civica-index/methodology/peer-grouping/page.tsx
  wraps it via <MarkdownContent>.

  TSX shell handles: H1, subtitle, page-meta line (version + version date
  + reviewStatusLabel), warning callout, cite section (CiteAccordion),
  footer nav. The markdown body covers every other section in document
  order including the coverage-limitations table.

  Footnotes use GFM syntax via remark-gfm (`[^N]` inline,
  `[^N]: text` at the bottom). Anchors via `## Heading {#anchor}`.
  Per content-templating audit v1.1 amendment §6.A.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts

  Validate with: npm run validate:content-templates
-->

## The problem {#problem}

Every comparison needs a peer set. Saying that France "ranks 12th" is meaningless without specifying the ranking universe — 12th out of what? No single country taxonomy is analytically appropriate for every subject, so Civica declares the comparison domain before selecting a cohort.

Two examples show why the domain matters:

- **Material outcomes.** Defaulting peer grouping to government type would group Nigeria's Human Development Index against fellow *presidential democracies* — the United States, France, Brazil, Indonesia, the Philippines. That is not an analytically useful peer set for human development; the relevant peers are sub-Saharan Africa lower-middle-income economies.
- **Governance outcomes.** Executive-form classifications can place countries with fundamentally different levels of electoral competition in the same broad category. Governance comparisons therefore need a lens that distinguishes closed autocracies from electoral autocracies, and electoral democracies from liberal democracies.

## The principle: peer sets are domain-specific {#principle}

No major reference institution defaults peer grouping to a single universal primitive. Our World in Data publishes development indicators against World Bank regional and income groupings; the World Bank itself groups by region (seven buckets), income (four tiers), and lending category; the International Monetary Fund and United Nations follow similar conventions.[^1] [^2] [^3] When governance is the subject, comparative politics standardly uses regime classifications like V-Dem's Regimes of the World or the Polity Project's scale.[^6] [^8]

Civica adopts the same domain-specific architecture. Material and governance indicators get different peer-grouping primitives because they answer different questions. Constitutional form — whether a country has a king, whether it's federal, whether it's a republic — is preserved as descriptive metadata, not as an analytical taxonomy.

## Material outcomes — World Bank region × income {#material-outcomes}

For Civica Conditions, the Human Development Index, GDP-based measures, demographics, and health outcomes, the default peer set is the country's World Bank region intersected with its World Bank income group. That gives seven regions × four income tiers = up to 28 cohorts; in practice only ~18 are populated.[^5]

Why region+income? The World Bank publishes country-and-lending groups precisely because policy-relevant material comparisons generally need both axes. A high-income East Asian economy (Singapore, Japan) has structurally different material outcomes from a low-income East Asian economy (Cambodia, Lao PDR), even though both share regional context. Conversely, a high-income economy in Sub-Saharan Africa (Seychelles) faces different material conditions from a high-income economy in North America (United States), even at matched income. Civica uses the World Bank's published convention for this material-outcome comparison.[^4] [^5]

## Governance outcomes — V-Dem Regimes of the World {#governance-outcomes}

For Civica Index dimensions (democratic quality, rule of law, freedoms and rights, corruption control), Pulse signals, and any governance-flavored ranking, the default peer set is the country's tier on V-Dem's Regimes of the World classification — one of four buckets: *closed autocracy*, *electoral autocracy*, *electoral democracy*, or *liberal democracy*.[^8]

Why V-Dem RoW over Bjørnskov-Rode / CGV for the default? RoW splits autocracy along the analytically meaningful electoral / closed axis and is methodologically coherent with the Civica Index's existing V-Dem dependency.[^8] [^9]

**Transparency note on V-Dem dependency.** The Civica Index already uses V-Dem indicators in two of its {{state.civicaIndex.dimensionCount}} dimensions (Democratic Quality, Rule of Law). Using V-Dem RoW as the governance peer set is presentational only — it determines which countries appear together in a ranking, not how their scores are computed. The CI's scoring formula is unchanged. There is no circularity, but the overlap is worth disclosing.

## Optional alternate regime lens — Bjørnskov-Rode / CGV {#alternate-regime-lens}

For users who want the executive-form-of-autocracy distinction (military dictatorship vs civilian dictatorship vs royal dictatorship), Bjørnskov-Rode / CGV is available as a user-toggleable alternate lens.[^7] [^10] [^11] [^12] CGV has six buckets: parliamentary democracy, presidential democracy, semi-presidential democracy, civilian dictatorship, military dictatorship, and royal dictatorship.

BR/CGV is useful for two reasons. First, it is the taxonomy used in a substantial body of comparative political economy research. Second, the executive-form distinction is sometimes the analytically relevant grouping — for example, when comparing fiscal discipline across military and civilian autocracies. Civica exposes it without making it the default.

## Constitutional form as metadata {#constitutional-form}

"Is there a king?" "Is the country federal?" "Is it a republic or a monarchy?" These are facts about the constitutional shell of the state, not analytical claims about how it should be compared. Civica preserves them as descriptive metadata, in two forms:

- **government_form_description** — free-text description drawn from the CIA World Factbook's government type field (e.g. "federal parliamentary democracy under a constitutional monarchy").[^13]
- **monarchy_status** — small controlled vocabulary for filterability:
  - `none` — No reigning monarch.
  - `constitutional` — Reigning monarch with constitutional limits and meaningful executive role (Liechtenstein, Jordan).
  - `ceremonial` — Reigning monarch with no executive role (United Kingdom, Sweden, Spain, Japan, Cambodia).
  - `elective` — Monarch chosen via political or religious process (Vatican conclave; Malaysia's rotating sultanate).
  - `absolute` — Reigning monarch without constitutional limits (Saudi Arabia).
  - `theocratic` — Religious head conflated with head of state where this is the load-bearing classification.

Neither field is used as a peer-grouping primitive. They are available as filters ("show me all ceremonial monarchies") and as searchable text on country pages. The vocabulary above is provisional — if the canonical fact-layer derivation lands a different vocabulary, this methodology adopts theirs and notes the diff in the changelog.

## Minimum-n rule and fallback chain {#minimum-n}

A peer band only renders when the cohort has at least **n ≥ {{state.peerGrouping.defaultMinN}}** countries. Below that floor, the panel falls back to a broader grouping with an explanatory label, following these chains:

**Material lens (region × income):**

1. region + income (the default)
2. region only
3. income only
4. global

**Governance lens (V-Dem RoW tier):**

1. V-Dem RoW tier (the default)
2. global

The governance fallback is flatter on purpose. RoW only has four tiers, so once a country is outside its tier the next-most-meaningful grouping is "all democracies" or "all autocracies" — categories that are honestly less interpretable than a clean global comparison.

When the fallback fires, the panel displays a small note such as "n=4 in region+income; using region only (n=21)." Readers should always be able to see when a substitution has happened.

## Coverage limitations — non-sovereign and ambiguous jurisdictions {#coverage-limitations}

Some jurisdictions lack World Bank or V-Dem coverage entirely. Civica documents the per-jurisdiction fallback explicitly rather than silently mapping these to the closest peer:

| Jurisdiction | World Bank | V-Dem RoW | Plan |
|---|---|---|---|
| Taiwan | Not listed | Covered | Use V-Dem RoW for governance; for material indicators, fall back to East Asia & Pacific + High income with a documented note. |
| Kosovo | Listed | Not in RoW pre-2008 | Both lenses available; flag RoW data as starting from inclusion year. |
| Palestine | Listed (West Bank and Gaza) | Not in RoW | World Bank for material; for governance, fall back to global with a 'no V-Dem coverage' indicator. |
| Western Sahara | Not listed | Not in RoW | Both lenses unavailable; show only government_form_description and a 'limited peer comparison available' pill. |
| Vatican City | Not listed | Not in RoW | Same as Western Sahara — descriptive metadata only. |

When neither lens applies, country pages display only the `government_form_description` and a "limited peer comparison available" pill. This explicit unavailability state is preferred to silent miscoding.

## Reference vintage {#reference-vintage}

Every external classification is pinned to a specific upstream vintage. The current pinned vintages, refreshed quarterly with the rest of the Civica reference data:

- **World Bank region + income** — World Bank Country and Lending Groups, refreshed annually each July. Civica pulls the latest at the next quarterly cut.[^5]
- **V-Dem Regimes of the World** — V-Dem dataset, refreshed annually each spring. The pinned-vintage label appears on every Civica surface that displays a V-Dem-derived cohort.[^9]
- **Bjørnskov-Rode / CGV** — distributed via the Quality of Government dataset, refreshed annually each January.[^12]
- **government_form_description** — CIA World Factbook, frozen January 2026. The Factbook is no longer actively maintained beyond that date; Civica may add a Wikidata cross-check in a future version, but for v1.0 the field is effectively static.[^13]

## Limitations {#limitations}

- **V-Dem cadence.** V-Dem updates annually. Intra-year regime transitions (a coup; a successful democratic transition) are not reflected in the peer-set classification until the next V-Dem release. Civica Pulse is scheduled to process events daily and present them separately, but it does not update the peer-set tier itself, which can lag a transition by months.
- **Non-sovereign jurisdictions.** Coverage gaps (Taiwan, Kosovo, Palestine, Western Sahara, Vatican City) are documented above. Civica falls back to global comparison or marks the lens unavailable rather than silently mapping to a near-peer.
- **government_form_description currency.** CIA Factbook is frozen January 2026. Constitutional changes after that date are not reflected in the description until an alternative source pipeline is wired up. The field is descriptive metadata, not analytical taxonomy, so this staleness is bounded in impact.
- **Single-lens defaults.** Each domain has one default peer lens. Power users may want to compose lenses ("electoral democracies in Sub-Saharan Africa") for finer-grained comparisons. Compound peer sets are not in v1.0; they are an explicit deferred enhancement.

See the site-wide [known-limitations policy](/policies#known-limitations) for how this section relates to every other Civica research artifact.

## Versioning + changelog {#versioning}

- **Current version:** {{state.peerGrouping.version}}, dated {{state.peerGrouping.adoptedAt}}. External review by a comparative-politics scholar is pending. Material changes to the lens definitions, minimum-n rule, fallback chain, or source vintages create a new methodology version.

Version increments, retractions, and corrections to this page follow the site-wide [versioning policy](/policies#versioning).

## References {#references}

[^1]: Our World in Data peer-grouping conventions [(ourworldindata.org)](https://ourworldindata.org/grapher-faqs).
[^2]: World Bank lending categories overview [(datahelpdesk.worldbank.org)](https://datahelpdesk.worldbank.org/knowledgebase/articles/906519).
[^3]: International Monetary Fund, World Economic Outlook country grouping [(imf.org)](https://www.imf.org/external/pubs/ft/weo/faq.htm).
[^4]: Our World in Data, HDI peer-grouping convention [(ourworldindata.org)](https://ourworldindata.org/human-development-index).
[^5]: World Bank, Country and Lending Groups (annual) [(datahelpdesk.worldbank.org)](https://datahelpdesk.worldbank.org/knowledgebase/articles/906519-world-bank-country-and-lending-groups).
[^6]: Cheibub, Gandhi, and Vreeland (2010). Democracy and dictatorship revisited. *Public Choice* 143(1–2): 67–101. [(doi.org/10.1007/s11127-009-9491-2)](https://doi.org/10.1007/s11127-009-9491-2)
[^7]: Bjørnskov, C. and Rode, M. (2020). Regime types and regime change: a new dataset on democracy, coups, and political institutions. *The Review of International Organizations* 15: 531–551. [(doi.org/10.1007/s11558-019-09345-1)](https://doi.org/10.1007/s11558-019-09345-1)
[^8]: Lührmann, A., Tannenberg, M. and Lindberg, S. I. (2018). Regimes of the World (RoW): opening new avenues for the comparative study of political regimes. *Politics and Governance* 6(1): 60–77. [(doi.org/10.17645/pag.v6i1.1214)](https://doi.org/10.17645/pag.v6i1.1214)
[^9]: V-Dem Institute, Varieties of Democracy dataset documentation [(v-dem.net)](https://www.v-dem.net/data/the-v-dem-dataset/).
[^10]: CGV original codebook (Cheibub, Gandhi, Vreeland 2010 replication archive) [(sites.google.com/site/joseantoniocheibub)](https://sites.google.com/site/joseantoniocheibub/datasets/dd).
[^11]: Bjørnskov-Rode regime data archive [(sites.google.com/view/martinrode)](https://sites.google.com/view/martinrode/data).
[^12]: Quality of Government Standard Dataset, distributing the BR/CGV data [(gu.se/en/quality-government)](https://www.gu.se/en/quality-government/qog-data/data-downloads/standard-dataset).
[^13]: CIA World Factbook (frozen January 2026) [(cia.gov/the-world-factbook)](https://www.cia.gov/the-world-factbook/).
