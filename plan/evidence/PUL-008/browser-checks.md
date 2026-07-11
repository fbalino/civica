# PUL-008 browser checks

Checked `http://localhost:3000/civica-index/methodology/pulse#sources` in the in-app browser on 2026-07-11.

## Desktop — 1440 × 1000

- Light and dark themes render the operating-source records in the canonical methodology layout.
- Four operating feed headings appear: Amnesty International, CIVICUS Monitor, GDELT, and Human Rights Watch.
- Retrieval, retained evidence, scope, rights, and blind-spot prose remain readable without a wide data table.
- Document scroll width is 1429px inside a 1440px viewport; no horizontal overflow.

Screenshots:

- `methodology-desktop-light.png`
- `methodology-desktop-dark.png`

## Mobile — 390 × 844

- Light and dark themes render the feed records as a single readable editorial column.
- Long source, rights, and scope values wrap without clipping.
- Document scroll width is 379px inside a 390px viewport; no horizontal overflow.
- Header and theme controls remain usable.

Screenshots:

- `methodology-mobile-light.png`
- `methodology-mobile-dark.png`

## Admin and runtime

- `/admin/pulse-review` correctly redirects an unauthenticated browser to `/admin/sign-in`; no credentials were transmitted.
- `/api/v1/pulse/source-coverage` returns four operating, zero degraded, and six inactive feeds.
- The browser console returned no warnings or errors after theme and viewport changes.
