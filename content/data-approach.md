<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is now
  the source of truth for /methodology/approach. The TSX shell at
  src/app/(reader)/methodology/approach/page.tsx wraps it via
  <MarkdownContent>. Edit prose HERE; the TSX no longer holds it.

  Substitution markers:
    {{stats.X | "fallback"}}    live counters from getSiteStats() with
                                soft-fail; the fallback is the prose
                                that ships when DATABASE_URL is unset
    {{state.X}}                 typed config from site-state.ts
    {{ctx.X}}                   pre-computed helpers (joined lists,
                                conjunction-aware prose) materialised
                                by the TSX shell

  Heading anchors are explicit via the `{#anchor-id}` token —
  see src/lib/content/markdown/remark-civica-anchors.ts. The ids
  match the TSX shell's SIDEBAR_ITEMS so the left-rail nav keeps
  working without coupling slugs to heading prose.

  Validate with: npm run validate:content-templates
-->

## The problem with single-source reference works {#problem}

Public country-data sites generally republish a single upstream source — usually the CIA World Factbook, sometimes Wikipedia infoboxes, occasionally the World Bank. This works until the source has a problem.

The CIA World Factbook was sunset on 4 February 2026. Its last vintage is frozen at January 2026 — a useful reference, but it stops getting updates. Wikipedia infoboxes are crowdsourced and frequently stale; one country's population on Wikipedia might be from 2014 even though a 2024 measurement is available elsewhere. The World Bank publishes excellent data but only for the indicators in its World Development Indicators basket, and only on its quarterly release cycle.

Worse, single-source sites tend to hide the limitation. When the source goes stale, the staleness propagates silently. When two reasonable people would draw on different sources, the choice gets made invisibly. When sources disagree, the disagreement gets buried.

Civica's approach is to integrate multiple authoritative publishers, expose the disagreements, and document the rules.

## Multi-source reconciliation {#multi-source}

Civica integrates {{stats.activeSources | "multiple"}} source orchestrators — one per upstream publisher — into a single canonical data layer. Currently:

- **Frozen archive:** CIA World Factbook (final January 2026 vintage, public domain).
- **Tier-1 publishers ({{ctx.tier1ShippedCount}}):** {{ctx.tier1ShippedShortNamesProse}}.
- **Governance-specialist sources:** V-Dem (Varieties of Democracy).
- **Knowledge spine:** Wikidata.
- **National statistics offices:** rolling out in waves — {{ctx.nsoActiveNamesProse}} in the first in-progress wave of {{ctx.nsoActiveCount}}.

Each source has a dedicated sync orchestrator that pulls fresh data on a documented cadence (quarterly for most Tier-1 publishers, annually for some classification sources, and a daily cadence for the Pulse event ingest when active — that automated refresh is currently paused). Each sync writes into a single canonical table called `country_facts`, with statement-level provenance: which source, which date the source measured the value, which license the data is shared under, which fact-key it corresponds to, and whether the row is a measurement or a forecast.

For a live count of facts, fact-keys, and multi-sourced coverage, see the [about page](/about#sources). The dataset is growing as new sources land and existing sources publish new vintages.

## What happens when sources disagree {#disagree}

When the World Bank says one number and the IMF says another, Civica does not silently pick one. The reconciliation resolver applies a documented rule set.

**Freshness as the default tiebreaker.** When two sources publish a value for the same country and indicator, the source with the more recent measurement date wins canonical, unless overridden by an editorial assertion. This handles the most common case — both publishers measured the same thing, one did it more recently, the recent measurement is canonical.

**Editorial assertions for domain canonicality.** Some publishers are canonical for some domains. The World Bank is canonical for most material indicators. V-Dem is canonical for democratic-quality measures. UNESCO is canonical for literacy and education. UNDP is canonical for the Human Development Index. These assertions are recorded as `civicaRole` metadata on each row. The resolver consults them when two sources have similar freshness.

**Forecasts vs measurements.** The IMF World Economic Outlook publishes both historical measurements and projections out to 2030. The ILO publishes nowcasts that extend beyond the current year. Civica tags rows distinctly: `value_type = 'measured'` for actuals and `value_type = 'projected'` for forecasts. The resolver requires canonical = measured whenever any measured row exists. Forecasts only win canonical when no measurement exists.

**Multi-canonical with scope predicate.** When two publishers are concurrently authoritative for a fact-key in a defined scope — for example, Eurostat is canonical for European Union public debt while the IMF is canonical globally — the system honors all three (Eurostat + IMF + OECD) with the scope predicate documented. Readers see all three; the methodology page explains the multi-canonical pattern.

**Disputes when sources materially disagree.** When two sources disagree by more than a configurable threshold, the resolver creates a dispute record routed to a human review queue. This protects against typos, unit-confusion bugs (a "$440B vs $4,400B" mistake), and methodology mismatches (CIA's central-government debt vs IMF's general-government debt) without silently picking one.

## What you see on reader pages {#reader-pages}

When you load a country page on Civica — the factbook, the civica-index detail, the atlas masthead, the compare overview — every value carries a small chevron next to it. That chevron is a *FactValueDot*. Click or hover it and you see:

- **The canonical pick.** Which source the resolver chose, the value, the as-of date.
- **Every alternate source.** Every other publisher that has a value for this country and indicator, with their value, date, and license.
- **The freshness winner.** Which source has the most recent measurement date.
- **The editorial canonical.** Which publisher Civica regards as the domain canonical, when that's a different question from freshness.
- **Provenance dots.** A green dot for live, regularly updated sources; an amber dot for frozen archives like the CIA Factbook.
- **A dispute marker** when sources materially disagree on the value.

Multi-year values (inflation, public debt, GDP variants, unemployment, military expenditure, current-account balance, exports, imports) get a "Civica canonical (reconciled)" row prepended above the CIA's per-year prose. The CIA's historical context is preserved; the reconciled current canonical sits at the top.

This is what we mean by "every fact carries provenance." It's not a slogan. It's the reader-facing surface of a documented multi-source pipeline.

## What "BETA" means here {#beta}

The data layer and reconciliation logic are real and load-bearing. The reader pages render real data, computed by the real resolver, against real sources.

Some surfaces still carry a BETA marker. This means one of two things.

The **Civica Index** composite scoring methodology (PCA-derived weights, {{state.civicaIndex.dimensionCount}} governance dimensions, frozen reference periods) is published but still in active development (a v2 methodology rebuild is in progress), and external academic review has not yet been completed. The page is in BETA pending review. Same for the **Civica Pulse** classification taxonomy — it has been backtested against {{state.pulse.backtest.cases.length}} historical shocks but has not been externally reviewed. **Reconciliation rules** are documented and live but the public-facing methodology page is being expanded as v1 closes out.

External methodologies that Civica cites — V-Dem Regimes of the World, World Bank country classifications, Bjørnskov-Rode regime taxonomy, the Cheibub-Gandhi-Vreeland classification — do not carry a BETA marker. They inherit the source institution's standing.

The honest framing: where Civica is asserting a novel methodology, BETA stays on until external review. Where Civica is republishing externally-attested classifications, the source's standing applies.

## What's still rolling out {#rolling-out}

Civica is in pre-launch. The reconciliation v1 milestone (full Tier-1 publisher integration plus the first national-statistics-office wave) is in active execution. The methodology page rewrite is the v1 capstone.

Things you may notice as the rollout progresses:

- **Some fact-keys are single-sourced.** {{stats.singleSourcedFactKeys | "Many"}} of {{stats.distinctFactKeys | "many"}} declared fact-keys currently have only one publisher. Reconciliation requires two sources to compare; for single-sourced facts, the reader page renders provenance but no alternates panel. As the NSO wave lands, single-sourced fact-keys gain second sources.
- **Some methodology pages are still being written.** Specifically, the reconciliation methodology page is being expanded as the rules formalize. Read the [methodology hub](/methodology) for the current state.
- **Some methodology resolutions are not yet public.** Civica has {{state.adoptedResolutionCount}}+ adopted internal resolution documents covering specific decisions. Public publication of a curated subset is on the roadmap.

## Where to dig deeper {#dig-deeper}

- Full reconciliation specification: [/country/methodology/reconciliation](/country/methodology/reconciliation)
- Civica Index composite scoring: [/civica-index/methodology](/civica-index/methodology)
- Civica Pulse event classification: [/civica-index/methodology/pulse](/civica-index/methodology/pulse)
- Peer grouping and country comparison: [/civica-index/methodology/peer-grouping](/civica-index/methodology/peer-grouping)
- Index of all methodology pages: [/methodology](/methodology)
- Data sources, licenses, last-sync timestamps: [/about](/about#sources)
- API documentation: [/api-docs](/api-docs)

## Get in touch {#contact}

If you spot a data error, a methodological gap, or a documentation inconsistency, please [contact us](/contact). We treat external feedback as load-bearing — the project's academic standing depends on it.
