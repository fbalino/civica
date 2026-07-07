<!--
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  This is the source of truth for README.md. Edit this file, NOT
  README.md. Regenerate via:
      npm run regenerate:readme
  Substitution syntax (see ~/civica/plan/readme-templating-implementation-v1.md
  and ~/civica/plan/site-stats-and-state-templating-design-v1.md):
      {{state.path.to.field}}
      {{stats.path.to.field}}
      {{stats.path | "fallback"}}     ← soft-fail when DB unreachable
      {{ctx.helperName}}              ← pre-computed in regenerator
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-->
# Civica Atlas

An open reference atlas of the world's countries, governments, and governance outcomes — built on multi-source reconciliation, statement-level provenance, and published methodology.

[civicaatlas.org](https://civicaatlas.org)

> **Status: {{ctx.launchPhaseProse}}.** The data layer and reader pages are live and being used by the team for end-to-end review. Public launch + external methodology review are planned phases, not shipped yet. See [Current state](#current-state) below.

---

## What this is

Civica Atlas is a research-lab-grade reference work for every country in the world. It is built in the same posture as [Our World in Data](https://ourworldindata.org), the [V-Dem Institute](https://v-dem.net), and the World Bank's statistical division — an academic publication with a UI on top, not a website that happens to have data. Every fact carries provenance, every methodology decision is documented in a citable resolution, and every disagreement between sources is surfaced rather than hidden.

The project's near-term goal is to be the visual, interactive successor to the CIA World Factbook (which was sunset on 4 February 2026), but the long-term project is bigger: a unified, methodologically defensible reference layer that academics, journalists, NGOs, and the public can cite without disclaimer.

## Three flagship outputs

### Civica Factbook — `/factbook/[country]`

Country dossiers covering geography, demographics, government, economy, energy, communications, transport, environment, military, and transnational issues for ~200 countries and territories. Each fact is reconciled across multiple authoritative sources (where coverage exists) and carries a per-fact provenance dot revealing every alternate source, freshness date, and license.

### Civica Index — `/civica-index`

An original composite governance score on a 0–100 scale, computed quarterly across {{ctx.civicaIndexDimensionCountWord}} governance dimensions: {{ctx.civicaIndexDimensionLabelsProse}}. Material conditions (human development, peace & security, economic stability) live on the separate `/civica-conditions` companion layer. Built on V-Dem, World Bank Worldwide Governance Indicators, Freedom House, Transparency International CPI, and supporting indices. PCA-derived weights ({{ctx.civicaIndexWeightsString}}), frozen reference periods, Monte Carlo uncertainty intervals. Currently in {{ctx.civicaIndexStatusUpper}} pending external methodological review.

### Civica Pulse — `/civica-index/pulse-changelog`

A daily directional signal layered on top of the Index. Ingests governance-relevant events from CIVICUS Monitor, Human Rights Watch, Amnesty International, ACLED, IPU, GDELT, and others. Multi-run LLM classifier with three-temperature agreement scoring. Asymmetric corroboration (positive events require specialist sources; restricted-press countries require multi-source confirmation). Backtested against {{state.pulse.backtest.cases.length}} named historical governance shocks ({{ctx.pulseBacktestCasesProse}}). Currently in {{ctx.pulseStatusUpper}}.

## What makes this different

Most public country-data sites republish a single upstream source (usually CIA Factbook, sometimes Wikipedia infoboxes). When sources disagree, the disagreement gets hidden behind whichever number won. When sources go stale, the staleness propagates silently. When new data lands, methodology questions get patched ad-hoc.

Civica's pipeline is built on opposite premises:

- **Multi-source reconciliation.** Currently {{stats.activeSources | "20"}} active source orchestrators (CIA Factbook archive; the {{ctx.tier1ShippedCountWord}} Tier-1 publishers — {{ctx.tier1ShippedFullNamesProse}}; V-Dem; Wikidata; and {{ctx.nsoInProgressCountWord}} national statistics offices already syncing — {{ctx.nsoInProgressNamesProse}}) writing into a canonical `country_facts` table. ~{{ctx.totalFactsRoundedThousands | "26,000"}} reconciled facts across {{stats.distinctFactKeys | "88"}} declared fact-keys. v1 target is {{ctx.tier1ShippedCount}} Tier-1 publishers (live, IEA scrapped due to license incompatibility) plus {{state.nsoTarget.min}}–{{state.nsoTarget.max}} national statistics offices (first wave: {{ctx.nsoInProgressCount}} in progress; {{ctx.nsoDeferredNamesProse}}).

- **Per-fact provenance.** Every value on every reader-facing page renders a `<FactValueDot>` chevron. Click it and you see the canonical pick, every alternate source, the as-of date per source, the publisher's license, and the freshness winner. Disagreements above a configurable threshold create disputes routed to a human review queue.

- **Forecast vs measurement.** The resolver distinguishes measured rows from projected rows (IMF WEO ships forecasts to 2030; ILO publishes nowcasts beyond the current year). Canonical picks come from measured rows when both exist. See [`forecast-vs-measurement-v1.md`](./docs/methodology-decisions.md#forecast-vs-measurement).

- **Multi-canonical with scope predicate.** When two Tier-1 publishers are concurrently authoritative for a fact-key in a defined scope (e.g., Eurostat + IMF + OECD all canonical for European public debt), the system honors all three rather than forcing one into "alternate."

- **Citable methodology.** Every load-bearing methodology decision is documented as a resolution document with citations to peer institutions and academic literature. Currently {{state.adoptedResolutionCount}}+ adopted resolutions covering peer grouping, reconciliation rules, fact-key registry expansions, source allowlist, classification taxonomy, dispute thresholds, NSO source decisions (per-country), and more.

- **Honest beta posture.** Novel Civica-asserted methodologies (the Civica Index composite, the Pulse classifier, the reconciliation rules) ship with a BETA pill until external academic review. Civica-cited external methodologies (V-Dem Regimes of the World, World Bank classifications, Bjørnskov-Rode regime taxonomy) inherit the source's standing without a beta marker.

## Current state

This is a pre-launch project. Honest snapshot:

| Metric | Status |
|---|---|
| Active source orchestrators writing facts | {{stats.activeSources | "20"}} ({{ctx.tier1ShippedCount}} Tier-1 + CIA archive + Wikidata + V-Dem + {{ctx.nsoInProgressCount}} NSO Wave 1) — IEA scrapped due to license incompatibility |
| `country_facts` rows | ~{{ctx.totalFactsRoundedThousands | "26,000"}} across {{stats.distinctFactKeys | "88"}} declared fact-keys |
| Multi-sourced fact-keys (≥2 sources, at least one country) | {{stats.multiSourcedFactKeys | "27"}} |
| 5+ source fact-keys | {{stats.fiveSourceFactKeys | "5"}} ({{ctx.fiveSourceFactKeyNamesProse}}) |
| Adopted methodology resolution docs | {{state.adoptedResolutionCount}}+ |
| NSO (national statistics office) syncs | First wave: {{ctx.nsoInProgressCount}} in progress ({{ctx.nsoInProgressNamesProse}}); {{ctx.nsoDeferredStatusTableProse}} |
| External methodology review | {{ctx.externalReviewStatusProse}} |
| Public launch | Pre-launch; URLs are live but no inbound traffic yet |

The reconciliation v1 milestone (full Tier-1 + first NSO wave + methodology page rewrite) is in active execution. The Civica Index methodology is currently in {{ctx.civicaIndexStatusUpper}}, scored under the v2-Beta {{ctx.civicaIndexDimensionCountWord}}-dimension composite (PCA-derived weights, see `/civica-index/methodology/pca-appendix`); the post-Beta stabilization cut-over is targeted for {{state.civicaIndex.cutoverTarget}} pending external academic review.

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
| Peer grouping — migration table (post-`structural_family` retirement) | `/civica-index/methodology/peer-grouping/migration` |

Internal methodology resolution documents (audit trail, eventually published) cover decisions like the Wikidata claim-selection policy, the forecast-vs-measurement value-type column, the trade-aggregate goods-vs-merchandise split, the fact-key registry expansion strategy, and more. Public publication of these resolutions is a v1.x deliverable.

## Standing on the shoulders of giants

Civica's data and posture are deeply indebted to the institutions whose work it cites and integrates:

- [Our World in Data](https://ourworldindata.org) — the canonical model for academic-grade public data presentation; Civica's reconciliation patterns mirror OWID's source-domain conventions.
- [V-Dem Institute](https://v-dem.net) — Varieties of Democracy data + Regimes of the World classification; the methodological gold standard for comparative-politics regime classification.
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

*Civica Atlas is a research-lab-grade reference work in active development. The data layer is real; the methodology is documented; the academic posture is taken seriously. None of that is the same as "finished." If you spot a methodological gap, a data error, or a documentation inconsistency, please open an issue or get in touch.*
