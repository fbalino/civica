# PUL-001 browser checks

**Local server:** `http://127.0.0.1:3000`

**Browser:** Chromium through `agent-browser`

**Routes:** `/country/brazil/civica-data`, `/civica-index/methodology/pulse`

## Active country route

- Desktop light at 1440 × 1000 rendered successfully.
- DOM assertion: `document.querySelectorAll('.pulse-dimensions-panel').length === 0`.
- The source-native Governance Evidence table remained the leading country comparison surface.
- Screenshot: `brazil-desktop-light.png`.

## Methodology route

- Desktop light and dark at 1440 × 1000 rendered successfully.
- Mobile light and dark at 390 × 844 rendered successfully.
- Dark captures explicitly asserted `document.documentElement.getAttribute("data-theme") === "dark"` before capture.
- Visible-text assertions found `pulse-v2.1-beta`, `API-only`, `experimental heuristics`, and the incomplete-independent-review disclosure.
- Mobile layout reported `scrollWidth: 379` at a 390-pixel viewport, so there was no horizontal overflow.
- Browser errors: none.
- Console: React development-tools informational message only.
- Screenshots: `methodology-desktop-light.png`, `methodology-desktop-dark.png`, `methodology-mobile-light.png`, `methodology-mobile-dark.png`.

The full-page screenshots were visually inspected after capture. The standing warning, method label, section hierarchy, and footer remained legible in both themes and at mobile width.
