# About Civica Atlas

Civica Atlas is an open reference atlas of the world's countries, governments, and governance outcomes. It combines data from authoritative sources into a single, browsable atlas of political systems, demographics, economies, and the institutions that shape them.

The project is built in the same posture as Our World in Data, the V-Dem Institute, and the World Bank's statistical division — an academic publication with a UI on top, not a website that happens to have data. Every fact carries provenance, every methodology decision is documented, and every disagreement between sources is surfaced rather than hidden.

## What we do

We do three things, each addressing a different question a serious reader might ask about a country.

### Civica Factbook — country dossiers

For each country and territory, the Factbook presents the kind of comprehensive reference profile the CIA World Factbook used to provide before its sunset on 4 February 2026 — geography, demographics, government, economy, energy, communications, transport, environment, military, and transnational issues. Where the original Factbook drew from a single source, ours reconciles across many: the frozen January 2026 Factbook itself plus the World Bank, IMF, UN, WHO, UNESCO, UNDP, OECD, FAO, ILO, Eurostat, WTO, V-Dem, and Wikidata as live, updating publishers. Every fact carries a provenance dot. Hover or click it to see every alternate source, the date each measured the value, and the license under which the data is shared.

### Civica Index — composite governance score

The Index is an original composite governance score on a 0–100 scale, computed quarterly across six dimensions: democratic quality, rule of law, freedoms, corruption control, stability, and government effectiveness. It draws on V-Dem, the World Bank Worldwide Governance Indicators, the UNDP Human Development Index, Freedom House, Transparency International, the Global Peace Index, and the Fragile States Index. Weights are PCA-derived, reference periods are frozen, and uncertainty intervals are produced via Monte Carlo simulation. The current version is in BETA pending external academic review.

### Civica Pulse — daily directional signal

The Pulse is a daily, event-driven signal layered on top of the Index. It ingests governance-relevant events from CIVICUS Monitor, Human Rights Watch, Amnesty International, ACLED, the Inter-Parliamentary Union, GDELT, and other sources, then routes each event through a multi-run LLM classifier with three-temperature agreement scoring. Severe-tier events are routed to human review before publication. Asymmetric corroboration rules raise the bar for positive events and for events from countries with restricted press freedom. The full pipeline is backtested against ten named historical governance shocks. Currently in BETA.

## How it works

The data pipeline has three layers, each addressing a known failure mode in single-source reference works:

**Sync orchestrators (one per source).** A dedicated TypeScript module per upstream publisher pulls fresh data on a documented cadence (quarterly for most Tier-1 publishers; annually for some classification-style sources; daily for the Pulse event ingest). Each sync writes into the canonical `country_facts` table with statement-level provenance: which source, which date, which license, what fact-key, what value.

**Reconciliation resolver.** When two or more sources publish a value for the same country and the same fact-key, the resolver picks a canonical based on freshness rules and editorial assertions (which publisher Civica regards as canonical for which domain — for example, V-Dem for governance indicators, the World Bank for material outcomes). When sources disagree by more than a configurable threshold, the resolver creates a dispute record routed to a human review queue rather than silently picking. Forecasts are tagged distinctly from measurements; canonical picks come from measurements when both exist.

**Reader surfaces.** Every reader-facing page on the site (factbook, civica-index, atlas, compare, embeds, public API) consumes the resolver. Every value renders a `FactValueDot` — a small chevron that opens a panel revealing the canonical pick, every alternate source, freshness dates, and licenses. Disputes appear as visible markers on the page; readers can see exactly when sources disagree and on what scale.

For the deep technical specification, see [Methodology — Reconciliation](/factbook/methodology/reconciliation). For a plain-English walkthrough, see [How we approach data](/methodology/approach).

## Methodology

Every load-bearing methodology decision in Civica is documented as a citable resolution before the corresponding code ships. The published methodology pages cover composite scoring (the Civica Index), event classification (the Civica Pulse), peer grouping (the V-Dem RoW + World Bank region/income lens architecture), reconciliation rules, the forecast-vs-measurement distinction, regime classification, and more.

Browse the full set at [/methodology](/methodology).

Internal methodology resolution documents covering decisions like the Wikidata claim-selection policy, the trade-aggregate goods-vs-merchandise split, source-allowlist policy, and dispute thresholds form the audit trail behind specific methodology calls. Public publication of these resolutions is a v1.x deliverable.

## Standing posture

Civica's approach is shaped by the institutions it cites and aspires to be cited alongside.

[Our World in Data](https://ourworldindata.org) is the canonical model for academic-grade public data presentation; Civica's reconciliation patterns mirror OWID's source-domain conventions for which publisher is canonical for which kind of indicator. The [V-Dem Institute](https://v-dem.net) sets the methodological standard for comparative-politics regime classification, which Civica adopts wholesale (Regimes of the World) for governance peer grouping. The [World Bank](https://data.worldbank.org), [IMF](https://www.imf.org), [UN agencies](https://unstats.un.org), [OECD](https://stats.oecd.org), and other Tier-1 publishers form the backbone of the data layer.

We are not these institutions. We do not have their funding, their staff, their decades of accumulated trust, or their formal review processes. What we have is a discipline of treating methodology decisions as citable artifacts, an honest beta posture for novel work, and a commitment to surfacing disagreement rather than hiding it.

## Open and free

Civica Atlas is built to be a free, open reference. The codebase is open-source. Public-domain and CC0-licensed data is freely available. Per-source licenses are preserved at the row level in `country_facts.license` and disclosed on every reader page.

If you are an academic interested in reviewing the methodology, citing the data, or collaborating on extensions, please get in touch via [civicaatlas.org/contact](/contact). External review is an explicit goal of the project, not a hypothetical.
