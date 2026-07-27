# EXP-032 — country Constitution route restored to the canonical three-tab shell

Completed 2026-07-12.

## Problem
The `/country/[slug]/constitution` tab used a bespoke `editorial-page--full` +
`country-constitution-body` shell with no country search and no shared sidebar,
while the Factbook and Civica Data tabs both use the shared
`.factbook-tab > .civica-data-body > .factbook-left-rail` grid
(`CountryJumpSearch` + `FactbookSidebar`). It also rendered an `<h2>Constitution
of {name}</h2>`, duplicating the country name already shown as the masthead H1.

## Fix (low-risk, additive)
- `ConstitutionReadingColumn` gains an additive `showOutline` prop (**default
  `true`**, so the standalone Constitution Explorer is unchanged). When `false`
  the in-column outline is suppressed and the body spans the full content
  column (`constitution-reader-layout--no-outline`).
- The Constitution tab now renders the exact shared shell: `.factbook-tab >
  .civica-data-body > .factbook-left-rail` with `CountryJumpSearch` +
  `FactbookSidebar`, and the reading body (with `showOutline={false}`) in the
  content column. The outline lives in the shared sidebar — its items are the
  constitution's parts (or articles when parts are sparse), each id a rendered
  section domId so the `ReaderSidebar` scroll-spy aligns.
- Headings: the masthead `<h1>` (country name) is the only H1; the tab's
  `<h2>` is "Full constitutional text" (reading) / "Not yet indexed" (empty) —
  no country name. Both states use the shared shell.
- Zero hardcoded values added (`validate:design-tokens` shows no new drift);
  dark mode is inherited through shared tokens/classes.

## Verification (browser, live dev server)
- **Reading state (US):** grid `240px 1fr`, left rail = country-jump-search +
  sticky search + `reader-sidebar factbook-sidebar` (29 scroll-spy items,
  first target present), single H1 ("United States"), H2 "Full constitutional
  text", in-column outline absent, 0px horizontal overflow, no console errors.
- **Empty state (Greenland):** same shared grid + rail + search + sidebar,
  single H1, H2 "Not yet indexed", CTA buttons only, 0px overflow.
- **Mobile (390px):** grid collapses to a single column, 0px overflow.
- **Dark:** content text tokens flip to dark-mode ivory (participates in
  theming); no hardcoded colors.
- **Standalone Explorer (`/constitution`) regression:** internal outline still
  present (3 items), standard 2-col layout, no `--no-outline` variant — the
  default `showOutline=true` preserves it.
- `tsc --noEmit` clean; `validate:design-tokens` passes; full suite green + 5
  new guard tests (`src/lib/qa/constitution-tab-shell.test.ts`).
