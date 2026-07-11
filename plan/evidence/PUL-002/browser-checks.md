# PUL-002 browser checks

**Route:** `http://127.0.0.1:3000/civica-index/methodology/pulse#research-charter`

**Browser:** Chromium through `agent-browser`

## Checks

- The stable `#research-charter` anchor resolved to the `Research charter` heading.
- Visible text included `pulse-ledger-charter/v1`, the documented-event unit, retirement/redesign language, and `No-value is a valid result`.
- Desktop light and dark rendered at 1440 × 1000.
- Mobile light and dark rendered at 390 × 844.
- Dark captures explicitly asserted `data-theme="dark"` before capture.
- Mobile reported `scrollWidth: 379` at a 390-pixel viewport, so there was no horizontal overflow.
- Browser errors: none.
- Console: React development-tools informational message only.

## Screenshots

- `charter-desktop-light.png`
- `charter-desktop-dark.png`
- `charter-mobile-light.png`
- `charter-mobile-dark.png`

The four viewport captures were visually inspected. The heading, version label, event-unit definition, scope boundary, and navigation remain legible in both themes and at mobile width.
