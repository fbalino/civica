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

  Registry markers (kept in this stripped authoring banner):
  PUBLIC_CLAIM: about.atlas-positioning
  PUBLIC_CLAIM: about.provenance-coverage
-->

Civica Atlas is a provenance-first comparative reference to how every country is governed. It brings country profiles, political institutions, constitutions, elections, and source-linked facts into one browsable atlas.

The atlas is the primary product. Civica's original Index and Pulse outputs are secondary research experiments: they remain beta while their constructs, methods, sensitivity, incremental value, and failure modes are tested. The project publishes its methods and aims to expose source disagreement rather than hiding it, without claiming that every value is already reconciled or independently reviewed.

## How it works {#how-it-works}

The data pipeline has three layers, each addressing a known failure mode in single-source reference works.

**Sync orchestrators (one per source).** A dedicated module per upstream publisher pulls fresh data on a documented cadence and writes into the canonical `country_facts` table with statement-level provenance.

**Reconciliation resolver.** When two or more sources publish a value for the same country and fact-key, the resolver picks a canonical based on freshness rules, editorial assertions, and forecast-vs-measurement distinctions. When sources disagree by more than a configurable threshold, it creates a dispute record routed to human review rather than silently picking.

**Reader surfaces.** Country pages consume the resolver for supported fact keys. Values backed by a canonical resolver record can render a *FactValueDot* — a small chevron that opens a panel showing the selected source, available alternatives, freshness dates, and licenses. Coverage is incomplete and will be published explicitly rather than implied to be universal.

For a plain-English walkthrough, see [How we approach data](/methodology/approach). For the deep technical specification, see [Methodology — Reconciliation](/country/methodology/reconciliation).

## Methodology {#methodology}

Civica maintains versioned methodology records for load-bearing research and reconciliation decisions. Published pages currently cover composite scoring (the Civica Index), event classification (the Civica Pulse), peer grouping (the V-Dem RoW + World Bank region/income lens architecture), reconciliation rules, forecast-vs-measurement, and regime classification. Documentation does not substitute for independent review.

Browse the full set at [/methodology](/methodology).

## Standing posture {#standing-posture}

Civica's approach is shaped by the institutions and data publishers it cites. Our World in Data is an important reference for transparent public-data presentation. V-Dem supplies a widely used comparative-politics regime classification. The World Bank, IMF, UN agencies, OECD, and other established publishers form the backbone of the data layer.

We are not these institutions. We do not have their funding, their staff, their decades of accumulated trust, or their formal review processes. Civica instead keeps versioned methodology records, labels novel work as beta, and aims to surface disagreement rather than hiding it.

## Open and free {#open-and-free}

Civica Atlas is built to be a free, open reference. The codebase is open-source. Public-domain and CC0-licensed data is freely available. Per-source licenses are preserved at the row level and disclosed on supported reader surfaces. If you are an academic interested in reviewing the methodology, citing the data, or collaborating on extensions, please [get in touch](/contact). External review is an explicit goal of the project, not a hypothetical.
