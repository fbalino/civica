# EXP-004 — eliminate page-local reader styling

Completed 2026-07-12. Live reader-style pages compose the shared primitives and
editorial classes; no page ships a per-page `<style>` block duplicating layout,
typography, filter, or card patterns.

## Finding: no migration was needed
An audit of `src/app` found **zero** inline `<style>` blocks in any page/layout
component (only the embed iframe generator — a `route.ts` handler that must emit
a standalone HTML document — uses inline CSS, and it is correctly excluded).
Every reader-style document page already composes the canonical shells:
- `/privacy`, `/terms` — `EditorialPage` + `methodology-layout` + `ReaderSidebar`
  + `editorial-section` (the DESIGN.md rule for multi-section legal/policy docs).
- `/licensing` — `EditorialPage` + `editorial-section`.
- `/policies` — `EditorialPage` + `MarkdownContent` + `editorial-section`.
- `/about` — `PageHero` + `MarkdownContent` + `editorial-section`.
- `/accessibility` — `editorial-page--full` + `editorial-section`.
- `/methodology` — `EditorialPage` + `methodology-layout` + `ReaderSidebar` +
  `MarkdownContent` + `editorial-section`.

The `<style>`-block elimination this task targeted had already been achieved by
the codebase's architecture (the 2026-05-06 content-templating engagement
extracted the methodology inline styles into `editorial.css`); EXP-004 verifies
the invariant holds and locks it against regression.

## Guard (`src/lib/qa/reader-page-styling.test.ts`)
- No page/layout `.tsx` under `src/app` contains an inline `<style>` block.
- Reader-style document pages compose a canonical editorial container +
  `editorial-section`/`MarkdownContent`, never hand-rolled layout.
- Legal/policy multi-section pages use `methodology-layout` + `ReaderSidebar`
  (not a bare narrow column) — the exact drift the owner flagged.

## Verification
- 3 guard tests pass; `tsc --noEmit` clean; full suite green.
- `/privacy` renders in the live dev server with no console errors and the
  correct methodology-layout + ReaderSidebar shell (no unintended drift).

## Note
Building a persistent screenshot/visual-regression baseline harness across
canonical modules is EXP-025's scope; EXP-004's "no drift" evidence here is the
0-change audit plus a live render of a representative reader page.
