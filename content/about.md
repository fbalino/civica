<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is now
  the source of truth for /about. The TSX shell at
  src/app/about/page.tsx wraps it via <MarkdownContent>.

  IMPORTANT — only the prose sections live here. The "What we do"
  3-card grid (Country Profiles / Civica Index / Civica Pulse), the DB-driven
  data-sources grid populated from getAllSources(), and the
  source-dot provenance legend stay in TSX. Edit those there. Edit
  prose HERE.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
    {{stats.X | "fallback"}}    live counters from getSiteStats()
                                (about doesn't currently use any)

  Heading anchors are explicit via the `{#anchor}` token —
  see src/lib/content/markdown/remark-civica-anchors.ts.

  Validate with: npm run validate:content-templates
-->

<!-- PUBLIC_CLAIM: about.atlas-positioning -->
Civica Atlas is an open reference atlas of the world's countries, governments, and governance outcomes. It combines data from authoritative sources into a single, browsable atlas of political systems, demographics, economies, and the institutions that shape them.

<!-- PUBLIC_CLAIM: about.provenance-coverage -->
The project is built in the same posture as Our World in Data, the V-Dem Institute, and the World Bank's statistical division — an academic publication with a UI on top, not a website that happens to have data. Every fact carries provenance, every methodology decision is documented, and every disagreement between sources is surfaced rather than hidden.

## How it works {#how-it-works}

The data pipeline has three layers, each addressing a known failure mode in single-source reference works.

**Sync orchestrators (one per source).** A dedicated module per upstream publisher pulls fresh data on a documented cadence and writes into the canonical `country_facts` table with statement-level provenance.

**Reconciliation resolver.** When two or more sources publish a value for the same country and fact-key, the resolver picks a canonical based on freshness rules, editorial assertions, and forecast-vs-measurement distinctions. When sources disagree by more than a configurable threshold, it creates a dispute record routed to human review rather than silently picking.

**Reader surfaces.** Every reader-facing page consumes the resolver. Every value renders a *FactValueDot* — a small chevron that opens a panel revealing the canonical pick, every alternate source, freshness dates, and licenses.

For a plain-English walkthrough, see [How we approach data](/methodology/approach). For the deep technical specification, see [Methodology — Reconciliation](/country/methodology/reconciliation).

## Methodology {#methodology}

Every load-bearing methodology decision in Civica is documented as a citable resolution before the corresponding code ships. Published methodology pages cover composite scoring (the Civica Index), event classification (the Civica Pulse), peer grouping (the V-Dem RoW + World Bank region/income lens architecture), reconciliation rules, forecast-vs-measurement, and regime classification.

Browse the full set at [/methodology](/methodology).

## Standing posture {#standing-posture}

Civica's approach is shaped by the institutions it cites and aspires to be cited alongside. Our World in Data is the canonical model for academic-grade public data presentation. The V-Dem Institute sets the methodological standard for comparative-politics regime classification. The World Bank, IMF, UN agencies, OECD, and other Tier-1 publishers form the backbone of the data layer.

We are not these institutions. We do not have their funding, their staff, their decades of accumulated trust, or their formal review processes. What we have is a discipline of treating methodology decisions as citable artifacts, an honest beta posture for novel work, and a commitment to surfacing disagreement rather than hiding it.

## Open and free {#open-and-free}

Civica Atlas is built to be a free, open reference. The codebase is open-source. Public-domain and CC0-licensed data is freely available. Per-source licenses are preserved at the row level and disclosed on every reader page. If you are an academic interested in reviewing the methodology, citing the data, or collaborating on extensions, please [get in touch](/contact). External review is an explicit goal of the project, not a hypothetical.
