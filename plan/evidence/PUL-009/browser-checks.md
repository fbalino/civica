# PUL-009 browser checks

Checked `http://localhost:3000/civica-index/methodology/pulse#observability` with Playwright Chromium on 2026-07-11.

## Desktop — 1440 × 1000

- Light and dark themes render the `Country-period observability` section in the canonical methodology layout.
- The sidebar includes `Observability states` after `Coverage limitations`.
- State identifiers, threshold prose, non-claim, and following limitations remain readable without clipping.

## Mobile — 390 × 844

- Light and dark themes render a single readable column.
- Long state identifiers wrap inside inline-code styling without horizontal clipping.
- The header and theme controls remain usable.

The inspected local screenshots are in the gitignored Playwright artifact directory:

- `output/playwright/PUL-009-methodology-desktop-light.png`
- `output/playwright/PUL-009-methodology-desktop-dark.png`
- `output/playwright/PUL-009-methodology-mobile-light.png`
- `output/playwright/PUL-009-methodology-mobile-dark.png`

The public page and the live Japan, Uruguay, Eritrea, China, and Brazil API requests returned HTTP 200 during the check.
