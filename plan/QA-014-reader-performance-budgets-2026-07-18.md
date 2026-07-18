# QA-014 / EXP-026 — Reader performance and payload budgets

## Design brief

Create one laboratory regression contract for representative reader routes,
not a claim that local Chromium reproduces field Core Web Vitals. The browser
test uses native `PerformanceObserver` entries for LCP, CLS, event timing, and
long tasks; fresh-context decoded response totals cover HTML, RSC, JavaScript,
CSS, images, fonts, and requests. Server response time comes from the
navigation timing entry. The existing `civica-query-budget/v1` continues to
own database execution p95s and result ceilings.

The fixed fixtures intentionally cover home, source-native Atlas geometry,
the Switzerland constitution reader, and an engraving-led Record article.
They are production-server routes, not a mocked component benchmark. The
contract has seeded payload and missing-map-measurement failures, and CI starts
the already-built app before running the browser budget suite.

The initial local production baseline uses decoded response bytes: the streamed
document includes its inlined RSC payload, and shared extracted stylesheets are
counted once per response. The checked caps retain a documented margin above
that baseline so compression changes and ordinary CI timing variation do not
hide genuine regressions or create a noisy one-run performance claim.

The credential-free CI server always measures the database-independent home
and Record fixtures. Atlas and the country constitution fixture run in the
same command only when `E2E_PERFORMANCE_FIXTURE_DB=1` selects the controlled,
read-only fixture-database environment; they are deliberately skipped instead
of pretending that a no-database `500` response measures a reader surface.

## Measurement posture

- The Core Web Vitals thresholds are field metrics: current web.dev guidance
  recommends p75 field LCP at or below 2.5 seconds, INP at or below 200 ms,
  and CLS at or below 0.1. This laboratory gate uses controlled regression
  ceilings and must not be presented as field conformance.
- Browser support for the `PerformanceObserver` API was checked against MDN
  on 2026-07-18. Unsupported/missing LCP or interaction timing fails closed
  rather than becoming a zero.
- Byte ceilings use decoded response bytes in a fresh Chromium context. This
  makes an asset payload regression visible even when transfer compression
  changes, while request count still includes external map inputs.

## Completion path

1. Add the checked `civica-reader-performance-budget/v1` fixture and budget
   contract, tied to the existing query-budget profiles for country and
   constitution reads.
2. Add pure fixtures that reject missing scope, invalid metrics, missing Atlas
   initialization, and a deliberately oversized payload.
3. Add the production-browser suite, persist its JSON result as a Playwright
   attachment, and run it as a required credential-free CI step.
4. Record a clean production-mode run and update the checklist, evidence, and
   progress only after the suite and its static gates pass.

## Completion evidence

Completed 2026-07-18. `civica-reader-performance-budget/v1` now enforces the
full reader payload, visual, interaction, server-response, and map-init
envelope on four production fixtures and links the data-heavy routes to the
existing query p95 contract. The pure contract has a seeded oversized-payload
failure; the CI workflow runs the credential-free production subset, while the
controlled read-only fixture database runs all four routes. The isolated
production suite passed 4/4 and the credential-free mode passed 2/2 applicable
routes (two explicitly skipped data-backed fixtures). See
`plan/evidence/QA-014/README.md` and `plan/evidence/EXP-026/README.md`.
