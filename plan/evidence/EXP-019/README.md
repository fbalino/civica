# EXP-019 — responsive matrix

Completed 2026-07-12. Every canonical route is loaded at the six declared
viewports and asserted to have no horizontal overflow of the root scroller.

## Matrix
- **Viewports (6):** small-mobile 360×740, large-mobile 480×900, tablet 768×1024,
  laptop 1024×768, desktop 1280×900, wide 1536×960.
- **Routes (30):** home; countries index; country factbook/civica-data/
  constitution tabs; atlas; compare; rankings; civica-index; governance-evidence;
  civica-conditions; methodology + approach; elections + electoral-systems;
  organizations; parties; glossary; blog index; api-docs; design-system; about;
  advisory-board; accessibility; licensing; privacy; terms; contact; policies;
  404/not-found. One per DESIGN.md layout row plus every primary reader route.
- **Total checks:** 30 routes × 6 viewports = **180**.

## Result
`npm run test:e2e -- e2e/responsive-matrix.spec.ts` → **30 passed** (0 horizontal
overflow at any viewport; the 404 route correctly returns 404; no uncaught page
error surfaced as a hard failure). Screenshots at the mobile and wide extremes
are captured to the gitignored `output/playwright/`.

## Spec (`e2e/responsive-matrix.spec.ts`)
Runs on the QA-009 harness. For each route it iterates the six viewports,
navigates (`domcontentloaded`), waits a bounded `load` + short settle (NOT
`networkidle` — a live MapLibre map / image-heavy index never idles), then
measures `documentElement.scrollWidth − clientWidth` and reports the offending
elements when it exceeds 1px. Page errors are captured as attached diagnostics,
not asserted — page-error/hydration correctness is EXP-020/EXP-028's scope.

## Findings from the first run (all resolved)
1. **atlas / blog-index timeouts** — the spec waited for `networkidle`, which
   never settles on the live map / lazy images. Fixed by a bounded `load` wait.
   Both now pass overflow at all six viewports.
2. **design-system "hydration mismatch"** — surfaced only under rapid automated
   multi-navigation and did NOT reproduce on a clean single load. Verified by
   fetching the server-rendered HTML directly: the SSR output already contains
   the exact `editorial-tooltip-trigger ds-ramp-cell-tip` wrapper the client
   renders (10 trigger spans present in SSR), so server and client match. Treated
   as an automation artifact, not a real bug; the SSR-safe Tooltip primitive
   (useSyncExternalStore mount gate) is unchanged.

## Note
No layout change was required — the shared editorial shells already hold at all
six widths. Durable regression coverage; re-runs under `npm run test:e2e`.
Screenshot/visual-regression baselines are EXP-025.
