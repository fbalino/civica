<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is the
  prose source of truth for the prose-only blocks on /methodology.
  The TSX shell at src/app/(reader)/methodology/page.tsx wraps it via
  multiple <MarkdownContent slice={...}> invocations.

  IMPORTANT — the per-section intro paragraphs for the FIVE entry-
  bearing sections (start-here, reconciliation, scoring, pulse,
  peer-grouping) live in the TSX SECTIONS typed array, NOT here. The
  cards rendered for those sections are rich React (link + beta pill +
  blurb) and don't translate to markdown without losing visual
  fidelity. Per content-templating audit v1.0 §3.2, the SECTIONS
  array stays in TSX.

  THIS file carries:
    - the three prose-only sections: BETA meaning, Not yet published,
      Get in touch
  Each prose-only section uses an explicit `{#anchor}` id that the
  TSX shell slices on. The page subtitle/lead-in is rendered by the
  TSX shell directly; not duplicated here.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
    {{ctx.X}}                   pre-computed helpers materialised
                                by the TSX shell

  Validate with: npm run validate:content-templates
-->

## What "BETA" means here {#beta-meaning}

Two kinds of pages on the site carry a BETA marker.

**Novel Civica-asserted methodologies** — the Civica Index composite, the Pulse classifier, the reconciliation rules — ship with BETA until external academic review. The methodology may be revised post-review with a documented changelog.

**External methodologies that Civica cites** — V-Dem Regimes of the World, World Bank country classifications, Bjørnskov-Rode regime taxonomy, the Cheibub-Gandhi-Vreeland classification — do not carry a BETA marker. They inherit the source institution's standing.

## What's not yet published {#not-yet-published}

Internal methodology resolution documents cover decisions like the Wikidata claim-selection policy, the forecast-vs-measurement value-type column, the trade-aggregate goods-vs-merchandise split, the fact-key registry expansion strategy, monarchy-status coding rules, and source-allowlist policy. These form the audit trail behind specific methodology calls and are currently held as working documents. Public publication of a curated subset is a v1.x deliverable — the goal is for any external reviewer to be able to read both *what* Civica decided and *how*.

## Get in touch {#get-in-touch}

If you spot a methodological gap, want to propose a refinement, or are interested in formal external review, please [contact us](/contact). External review is an explicit project goal, not a hypothetical.
