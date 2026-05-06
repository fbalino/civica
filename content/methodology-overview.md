<!--
  Phase 3 update 2026-05-05: prose values mirror the rendered page at
  src/app/(reader)/methodology/page.tsx, which interpolates against
  src/lib/content/site-state.ts. When this markdown is migrated to
  runtime rendering (Phase 5 design), inline counts get replaced
  by `{{state.*}}` per the audit's §5.3 variable schema.
-->

# Methodology

Every load-bearing methodology decision in Civica is documented as a citable resolution before the corresponding code ships. This page indexes every published methodology document on the site, organized by domain.

## Start here

If you're new to how Civica handles data and want a plain-English walkthrough before the deep specifications, start with [How we approach data](/methodology/approach).

For the academic specifications themselves, the documents below are the authoritative source.

## Data reconciliation

How Civica integrates and reconciles data from multiple authoritative publishers, what the resolver does when sources disagree, what provenance signals mean on reader pages.

| Document | What it covers |
|---|---|
| [Reconciliation](/factbook/methodology/reconciliation) | The full specification of how the resolver works. Source taxonomy, the canonical-fact layer, freshness rules, editorial assertions, the dispute system, forecast vs measurement, multi-canonical with scope predicate. |

## Composite scoring — the Civica Index

The Civica Index is an original 0–100 composite governance score covering 4 governance dimensions, computed quarterly. Its methodology covers indicator selection, weighting, reference periods, and uncertainty.

| Document | What it covers |
|---|---|
| [Civica Index methodology](/civica-index/methodology) | The composite specification — 4 governance dimensions, indicator basket, sources, frozen reference periods, weighting approach, uncertainty intervals. |
| [PCA appendix](/civica-index/methodology/pca-appendix) | The mathematical derivation of the Index weights from principal component analysis on the indicator basket. |

## Event-driven scoring — the Civica Pulse

The Pulse is a daily directional signal layered on the Index. It ingests governance-relevant events from multiple source feeds, classifies each via a multi-run LLM consensus, applies asymmetric corroboration rules, and decays impacts over time.

| Document | What it covers |
|---|---|
| [Pulse methodology](/civica-index/methodology/pulse) | The full pipeline — source taxonomy, multi-run classifier, severity tiers, corroboration rules, press-freedom modulation, decay function, double-counting prevention. |
| [Pulse backtest](/civica-index/methodology/pulse/backtest) | Backtest results against 10 named historical governance shocks (Myanmar 2021, Niger 2023, Tunisia 2021, Afghanistan 2021, Sri Lanka 2022, Brazil 2023, Hungary 2010-present, Ethiopia 2020–22, Colombia 2016, Poland 2023). |

## Classification and peer grouping

Civica's approach to comparing countries to one another is domain-specific: material outcomes use World Bank region × income, governance outcomes use V-Dem Regimes of the World, with Bjørnskov-Rode / CGV available as an alternate regime lens. Constitutional form is preserved as descriptive metadata, not as an analytical taxonomy.

| Document | What it covers |
|---|---|
| [Peer grouping](/civica-index/methodology/peer-grouping) | The peer-lens architecture, why government type is not a peer-grouping primitive, how the n ≥ 8 minimum-n rule works, the documented fallback chain. |
| [Peer grouping migration](/civica-index/methodology/peer-grouping/migration) | The per-country migration table after the retirement of the legacy `structural_family` taxonomy. |

## What "BETA" means here

Two kinds of pages on the site carry a BETA marker:

**Novel Civica-asserted methodologies** (the Civica Index composite, the Pulse classifier, the reconciliation rules) ship with BETA until external academic review. The methodology may be revised post-review with a documented changelog.

**External methodologies that Civica cites** (V-Dem Regimes of the World, World Bank country classifications, Bjørnskov-Rode regime taxonomy) inherit the source's standing without a BETA marker — Civica is republishing externally-attested classifications, not asserting a novel composite.

## What's not yet published

Internal methodology resolution documents cover decisions like the Wikidata claim-selection policy, the forecast-vs-measurement value-type column, the trade-aggregate goods-vs-merchandise split, the fact-key registry expansion strategy, monarchy-status coding rules, and source-allowlist policy. These form the audit trail behind specific methodology calls and are currently held as working documents. Public publication of a curated subset is a v1.x deliverable — the goal is for any external reviewer to be able to read both *what* Civica decided and *how*.

## Get in touch

If you spot a methodological gap, want to propose a refinement, or are interested in formal external review, please [contact us](/contact). External review is an explicit project goal, not a hypothetical.
