# ATL-013 browser check — 2026-07-13

## Product routes

- Unsupported: `http://127.0.0.1:3100/country/japan/civica-data?section=bills#bills`
- Supported/populated: `http://127.0.0.1:3100/country/united-states/civica-data?section=bills#bills`

## Matrix exercised

| State | Viewport | Theme | Result | Screenshot |
| --- | --- | --- | --- | --- |
| Japan unsupported | 1200 × 1200 | light | Bills entry and country-specific coverage warning visible | `japan-unsupported-desktop-light.png` |
| Japan unsupported | 1200 × 1200 | dark | Same content and non-color warning treatment visible | `japan-unsupported-desktop-dark.png` |
| Japan unsupported | 390 × 844 | light | Warning wraps without clipping; source-coverage link remains visible | `japan-unsupported-mobile-light.png` |
| Japan unsupported | 390 × 844 | dark | Warning wraps without clipping; source-coverage link remains visible | `japan-unsupported-mobile-dark.png` |
| United States populated | 390 × 844 | dark | Supported scope, 20-versus-total disclosure, bill source/freshness/status/timeline visible | `united-states-supported-mobile-dark.png` |

The sidebar `Bills` destination and the `source coverage report` are semantic
links in the accessibility snapshot. Activating the Bills link restores the
`#bills` state at both viewports. The snapshots exposed one page H1 and the
expected `07 · Bills` heading.

## Console and requests

- Product console errors: 0 on Japan and United States.
- Actionable failed requests: 0.
- Development-only warnings were limited to Next.js preload/CSP report-only
  diagnostics and did not affect the route.

## Browser tooling

The required Codex in-app Browser skill was attempted first twice, including
a clean runtime reconnect. The desktop bridge failed before browser selection
with `Cannot redefine property: process`. Direct Computer Use was then tried
as a recovery path, but the runtime explicitly forbids controlling the Codex
app window. The acceptance matrix was completed in a live headed Chromium
session through the Playwright CLI fallback.

The unrelated development-only typography-test trigger was hidden in the
browser DOM for clean evidence captures; no source file or persisted browser
state was changed. The owner-confirmed typography tester and Uruguay/Ghana/
Japan color-photo trials remain untouched in the worktree.
