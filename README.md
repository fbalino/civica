<!--
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  This file is GENERATED from README.template.md by
  scripts/regenerate-readme.ts. Do not edit it directly — your changes
  will be overwritten on the next regeneration. Edit the template,
  then run:
      npm run regenerate:readme
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->
# Civica Atlas

<!-- PUBLIC_CLAIM: readme.positioning -->
Civica Atlas is a provenance-first comparative reference to how every country is governed.

[civicaatlas.org](https://civicaatlas.org)

<!-- PUBLIC_CLAIM: readme.release-status -->
> **Status: pre-launch beta.** The data layer and reader pages are live and being used by the team for end-to-end review. Public launch + external methodology review are planned phases, not shipped yet. See [Current state](#current-state) below.

---

## What this is

Civica Atlas brings country profiles, political institutions, constitutions, elections, and source-linked facts into one browsable reference. The atlas is the primary product. The Civica Index and Civica Pulse are secondary research experiments and remain beta while their constructs, methods, sensitivity, usefulness, and failure modes are tested.

The near-term goal is to preserve and extend the comparative-reference role of the CIA World Factbook, which was sunset on 4 February 2026. Civica aims to publish a transparent reference layer that researchers, journalists, NGOs, students, and the public can inspect, correct, and cite with its stated limitations.

## Primary atlas and research experiments

### Country atlas — primary reference surface

Country dossiers cover geography, demographics, government, economy, energy, communications, transport, environment, military, and transnational issues. Facts retain upstream source, vintage, and rights context; multi-source reconciliation and alternate-source panels appear where the current resolver has coverage.

### Civica Index — secondary research beta

<!-- PUBLIC_CLAIM: readme.index-estimate -->
A research-beta 0–100 composite across four governance dimensions: democratic quality, rule of law, freedoms & rights, and corruption control. It uses V-Dem, World Bank Worldwide Governance Indicators, Freedom House, Transparency International CPI, and supporting inputs. Published bounds are Monte Carlo input-variation ranges under declared assumptions, not confidence intervals for a true country score. The Index is currently BETA and has not completed external methodological review; its construction, weights, and interpretation remain subject to validation.

### Civica Pulse — experimental event ledger

<!-- PUBLIC_CLAIM: readme.pulse-signal -->
An experimental ledger of governance-relevant events with model-assisted classification, source links, and review state. It is not a continuous measure of governance change, and no detected event does not mean stability. Numeric effects remain experimental pending representative evaluation and independent review. Current status: BETA.

## What makes this different

Most public country-data sites republish a single upstream source (usually CIA Factbook, sometimes Wikipedia infoboxes). When sources disagree, the disagreement gets hidden behind whichever number won. When sources go stale, the staleness propagates silently. When new data lands, methodology questions get patched ad-hoc.

Civica's pipeline is built on opposite premises:

- **Multi-source reconciliation.** Currently 20 active source orchestrators (CIA Factbook archive; the eleven Tier-1 publishers — World Bank WDI, IMF WEO, UN Data, WHO GHO, UNESCO UIS, UNDP HDI, OECD.Stat, FAO FAOSTAT, ILO ILOSTAT, Eurostat, WTO Stats; V-Dem; Wikidata; and six national statistics offices already syncing — US Census Bureau, ONS-UK, INSEE-FR, Statistics Canada, IBGE-BR, Stats SA) writing into a canonical `country_facts` table. ~26,000 reconciled facts across 88 declared fact-keys. v1 target is 11 Tier-1 publishers (live, IEA scrapped due to license incompatibility) plus 30–40 national statistics offices (first wave: 6 in progress; Destatis-DE deferred to v1.1; NBS-Nigeria permanently deferred).

- <!-- PUBLIC_CLAIM: readme.per-value-provenance --> **Per-fact provenance where implemented.** Resolver-backed values can render a `<FactValueDot>` chevron showing the selected source, available alternatives, observation dates, and license metadata. Civica does not yet claim universal per-value coverage.

- **Forecast vs measurement.** The resolver distinguishes measured rows from projected rows (IMF WEO ships forecasts to 2030; ILO publishes nowcasts beyond the current year). Canonical picks come from measured rows when both exist. See [`forecast-vs-measurement-v1.md`](./docs/methodology-decisions.md#forecast-vs-measurement).

- **Multi-canonical with scope predicate.** When several publishers are designated canonical for different documented scopes (for example, Eurostat, IMF, and OECD coverage of European public debt), the system preserves the scoped observations rather than forcing one into "alternate."

- **Versioned methodology.** Load-bearing research and reconciliation decisions are documented with citations and revision history. Documentation improves auditability but is not evidence of independent review or validity.

- **Honest beta posture.** Novel Civica-asserted methodologies (the Civica Index composite, the Pulse classifier, the reconciliation rules) ship with a BETA pill until external academic review. Civica-cited external methodologies (V-Dem Regimes of the World, World Bank classifications, Bjørnskov-Rode regime taxonomy) inherit the source's standing without a beta marker.

## Current state

This is a pre-launch project. Honest snapshot:

| Metric | Status |
|---|---|
| Active source orchestrators writing facts | 20 (11 Tier-1 + CIA archive + Wikidata + V-Dem + 6 NSO Wave 1) — IEA scrapped due to license incompatibility |
| `country_facts` rows | ~26,000 across 88 declared fact-keys |
| Multi-sourced fact-keys (≥2 sources, at least one country) | 27 |
| 5+ source fact-keys | 5 (population, life expectancy, unemployment, inflation, public debt) |
| Adopted methodology resolution docs | 30+ |
| NSO (national statistics office) syncs | First wave: 6 in progress (US Census Bureau, ONS-UK, INSEE-FR, Statistics Canada, IBGE-BR, Stats SA); Destatis-DE deferred to v1.1 (Genesis-Online API requires manual account creation with regulatory review, outside Civica's unattended-cron architecture. Eurostat republishes Destatis figures in the meantime.); NBS-Nigeria permanently deferred (primary data is PDF/Excel; ingestion cost not justified for v1.) |
| External methodology review | Not yet — planned post-v1 |
| Public launch | Pre-launch; URLs are live but no inbound traffic yet |

The reconciliation v1 milestone (full Tier-1 + first NSO wave + methodology page rewrite) is in active execution. The Civica Index methodology is currently in BETA, scored under the v2-Beta four-dimension composite (PCA-derived weights, see `/civica-index/methodology/pca-appendix`). Stabilization depends on longitudinal, factor-analysis, and input-variation validation plus external academic review; no launch date is claimed.

For live numbers (active sources, fact counts, multi-sourced coverage), see `/about` — values are read directly from the database, not maintained as inline prose. Page values may briefly differ from the metrics above as new vintages land.

Reader pages may show "BETA" markers in places where the underlying data layer or methodology is still being finalized. This is by design — silent staleness is dishonest; flagged staleness is academic discipline.

## Architecture

High-level data flow:

```
┌───────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Sync orchestrators│───▶│  country_facts   │───▶│     resolver     │
│   (one per src)   │    │ (provenance per  │    │ (freshness rules │
│  e.g. WB WDI,     │    │   row, source,   │    │  + editorial     │
│  IMF WEO,         │    │   as_of, license,│    │  assertion +     │
│  UN, WHO, etc.)   │    │   value_type)    │    │  dispute guard)  │
└───────────────────┘    └──────────────────┘    └────────┬─────────┘
                                                          ▼
                                       ┌──────────────────────────────┐
                                       │ Reader surfaces              │
                                       │   /factbook/[country]        │
                                       │   /civica-index/[country]    │
                                       │   /atlas/[country]/[tab]     │
                                       │   /api/v1/...                │
                                       │ (FactValueDot per fact)      │
                                       └──────────────────────────────┘
```

Detailed architecture: see [Methodology — Reconciliation](https://civicaatlas.org/factbook/methodology/reconciliation).

## Methodology

Public methodology pages (in approximate read order):

| Topic | URL |
|---|---|
| **How we approach data** (intro, plain English) | `/methodology/approach` |
| **Methodology hub** (index of every methodology page) | `/methodology` |
| Reconciliation — multi-source resolver, dispute rules, provenance | `/factbook/methodology/reconciliation` |
| Civica Index — composite scoring, dimensions, weights | `/civica-index/methodology` |
| Civica Index — PCA appendix (the math) | `/civica-index/methodology/pca-appendix` |
| Civica Pulse — event classification + scoring | `/civica-index/methodology/pulse` |
| Civica Pulse — backtest results | `/civica-index/methodology/pulse/backtest` |
| Peer grouping — V-Dem RoW, World Bank region/income, regime classification | `/civica-index/methodology/peer-grouping` |

Internal methodology resolution documents (audit trail, eventually published) cover decisions like the Wikidata claim-selection policy, the forecast-vs-measurement value-type column, the trade-aggregate goods-vs-merchandise split, the fact-key registry expansion strategy, and more. Public publication of these resolutions is a v1.x deliverable.

## Standing on the shoulders of giants

Civica's data and posture are deeply indebted to the institutions whose work it cites and integrates:

- [Our World in Data](https://ourworldindata.org) — an important reference for transparent public-data presentation and source documentation.
- [V-Dem Institute](https://v-dem.net) — Varieties of Democracy data and the widely used Regimes of the World classification.
- [World Bank](https://data.worldbank.org) — World Development Indicators, Worldwide Governance Indicators, country & lending classifications.
- [International Monetary Fund](https://www.imf.org/en/Publications/WEO) — World Economic Outlook macroeconomic data and projections.
- [United Nations Statistics Division](https://unstats.un.org), [UN Population Division](https://population.un.org), [UNDP](https://hdr.undp.org), [WHO Global Health Observatory](https://www.who.int/data/gho), [UNESCO Institute for Statistics](https://uis.unesco.org), [OECD.Stat](https://stats.oecd.org), [FAO FAOSTAT](https://www.fao.org/faostat), [ILO ILOSTAT](https://ilostat.ilo.org), [Eurostat](https://ec.europa.eu/eurostat), [WTO Stats](https://stats.wto.org).
- [Inter-Parliamentary Union (IPU Parline)](https://data.ipu.org) — national parliament structural data.
- [Constitute Project](https://constituteproject.org) — full-text constitutions for 200+ countries.
- [Bjørnskov-Rode / CGV regime classification](https://qog.pol.gu.se) — academic regime taxonomy.
- [Wikidata](https://www.wikidata.org) — structured knowledge spine.

A complete list of sources, licenses, and last-sync timestamps is at [/about](https://civicaatlas.org/about).

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack, React 19)
- **[Neon](https://neon.tech)** (serverless Postgres) via `@neondatabase/serverless`
- **[Drizzle ORM](https://orm.drizzle.team)** (type-safe schema in `src/lib/db/schema.ts`)
- **Tailwind CSS v4** + hand-authored editorial CSS with a strict design-token discipline (no hex literals in component code)
- **[Anthropic SDK](https://docs.anthropic.com)** — Claude powers `/api/chat` and the Pulse event classifier
- **[Vercel](https://vercel.com)** for hosting and cron orchestration

The full design system reference lives at [/design-system](https://civicaatlas.org/design-system) on the running site.

## Getting started

```bash
git clone https://github.com/fbalino/civica.git
cd civica
npm install
cp .env.example .env.local
# Fill in DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_USERNAME/ADMIN_PASSWORD_HASH/ADMIN_SESSION_SECRET, CRON_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required env vars (documented in `.env.example`):

- `DATABASE_URL` — Neon Postgres connection string
- `ANTHROPIC_API_KEY` — required for `/api/chat` and Pulse event classification
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` / `ADMIN_SESSION_SECRET` — the admin-login credentials for the `/admin` back office and `/api/admin/*` routes (all three required; routes fail closed if unset). Generate the password hash with `npm run admin:set-password`.
- `CRON_SECRET` — bearer token for the Vercel cron endpoints

Common npm scripts:

```bash
npm run db:generate              # Drizzle schema migration
npm run db:push                  # Push schema to Neon
npm run seed:sources             # Seed the sources table
npm run seed:factbook            # Import the CIA Factbook archive
npm run sync:factbook:wb-wdi     # World Bank WDI sync
npm run sync:factbook:imf-weo    # IMF WEO sync
npm run sync:factbook:un-data    # UN Data sync
# ... one sync orchestrator per source; see package.json
npm run pulse:v2:all             # Run the full Pulse pipeline (ingest → cluster → classify → score)
npm run regenerate:readme        # Regenerate README.md from README.template.md
```

Full script reference: see [AGENTS.md](./AGENTS.md).

## Contributing

Civica is open-source and welcomes contributions. Most public-facing content is CC0 or under the original publisher's license (preserved per-row in `country_facts.license`). The Civica codebase itself is MIT-licensed.

If you're an academic interested in reviewing the methodology, please get in touch — external review is an explicit goal of the project, not a hypothetical.

For development conventions and project memory, see [AGENTS.md](./AGENTS.md) and [DESIGN.md](./DESIGN.md).

## Status & contact

- **Live site**: [civicaatlas.org](https://civicaatlas.org)
- **Status page**: [statuspage.incident.io/civica-atlas](https://statuspage.incident.io/civica-atlas)
- **API documentation**: [civicaatlas.org/api-docs](https://civicaatlas.org/api-docs)
- **Design system reference**: [civicaatlas.org/design-system](https://civicaatlas.org/design-system)
- **Contact**: [civicaatlas.org/contact](https://civicaatlas.org/contact)

---

*Civica Atlas is an actively developed comparative reference. Its methods, source coverage, and experimental outputs remain open to correction and review. If you spot a methodological gap, data error, or documentation inconsistency, please open an issue or get in touch.*
