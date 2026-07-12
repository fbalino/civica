# Drift wave 2 — plan for the 18 sweep findings (2026-07-02)

Source: the two-agent sitewide sweep from the hero workflow (wovjqs2rg),
run after the compare/constitution/civica-index/about hero normalization.
Execution recipe: parallel Opus/Sonnet builders on disjoint file sets →
coordinator screenshot gate on every touched page → single build gate →
commit in slices.

## DF-A — Broken styling (2 HIGH — ship first)
1. `/civica-index/corrections` — the entire form (`corr-form`, `corr-field`,
   `corr-label`, `corr-select`…) uses classes that exist in NO stylesheet;
   the form renders browser-default. Fix: restyle on canonical form
   patterns (tokenized labels, --radius-search inputs, .btn submit) in the
   civica-index.css family.
2. `/civica-index/pulse-changelog` — the Country `<select
   class="editorial-filter-select">` has no matching CSS rule. Fix: replace
   the native select with the canonical dropdown pattern (almanac-dd
   interaction) or properly style the class; must match the page's other
   filter chips.
Owner-visible severity: these look broken today. → **Op 4.8 agent #1**

## DF-B — Page headers (3 MEDIUM + 2 LOW; needs design judgment)
3. `/rankings` — legacy `.page-heading`, no eyebrow/hero. → full-bleed
   canonical hero (top-level nav surface; same treatment as compare).
4. `/elections` — legacy `.hero-heading` at 64px. → full-bleed canonical
   hero (top-level nav surface), keep the stat row beneath.
5. `/civica-conditions` (OutcomesExplorer.tsx) — fully inline-styled
   header + breadcrumb. → compact tokenized editorial header (NOT the tall
   hero — it's an analytical tool view), classes not inline styles.
   ALSO absorb finding 8 here (same file): the three inline-styled
   `<select>`s (Year/Metric/Lens) → tokenized classes.
6. `/civica-index/government-types` — H1 lives inside the client explorer
   with no page-level header. → standard page header (eyebrow +
   editorial-page-title) in page.tsx above the explorer. (LOW)
7. `/civica-index/widget` — bespoke compact `.widget-hero`. → keep compact
   (it's a tool page) but align tokens/classes with the editorial header
   pattern. (LOW)
→ **Op 4.8 agent #2** (owns OutcomesExplorer.tsx entirely)

## DF-C — Non-canonical controls + orphan cleanup (LOW, mechanical)
8. (absorbed into DF-B item 5)
9. `/elections` `.cv-select` — mono font on a filter select → canonical
   filter styling (sans, --radius-control).
10. `CompareInAtlasClient.tsx` inline-styled select — this file is a
    CONFIRMED ORPHAN (flagged in audit Wave C, dd7ad6c). Fix by DELETION,
    along with `Hemicycle.tsx` (orphaned once the atlas shell died) —
    grep-prove zero references first.
11. `WidgetBuilder` `.wb-input` — --radius-sm → --radius-search (canonical
    search-field rounding).
→ **Sn 5 agent #3**

## DF-D — Motion adoption (LOW, mechanical, big surface)
12. `/rankings` (agent #2 adds the hero; this adds Reveal on the tables)
13. `/elections` (same split)
14. `/civica-index/government-types` explorer sections
15. `/civica-index/methodology` tree (8 sub-pages)
16. `/organizations/[slug]`
17. `/methodology` + `/methodology/approach`
18. Utility pages (api-docs, licensing, contact) — SKIP for now per the
    sweep's own note (reference pages, lowest value).
Pattern: standard Reveal/Stagger per the Reveal.tsx contract (reduced-
motion + SSR fail-safe are built into the primitives; just compose them).
→ **Sn 5 agent #4** (page files only; must not touch files owned by #1–#3:
rankings/elections page bodies coordinate with #2's header edits — #4 runs
AFTER #2 lands on those two files, or scopes to sections #2 doesn't touch)

## Sequencing
1. Launch #1 (DF-A) + #2 (DF-B) + #3 (DF-C) in parallel (disjoint files).
2. #4 (DF-D) launches after #2 reports (shares rankings/elections files).
3. Coordinator gate: screenshot every touched page light+dark, one
   `npm run build`, commit per wave slice, push once, prod smoke.

## Out of scope (tracked elsewhere)
- New hero ART for the normalized pages — owner is having Codex produce it.
- The three legacy hero implementations (.home-hero/.factbook-landing-hero/
  .about-hero) converging — recon note; revisit after Codex art lands.
- Utility-page motion (finding 18) — deliberately skipped.
