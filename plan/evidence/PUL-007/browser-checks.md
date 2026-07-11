# PUL-007 browser checks

Checked `http://localhost:3000/civica-index/methodology/pulse#source-independence` in the in-app browser on 2026-07-11.

## Desktop — 1440 × 1000

- Light and dark themes render the new section in the canonical methodology layout.
- The anchor lands with the heading visible below the fixed header.
- The sidebar contains the numbered `Source independence` entry.
- The method identifier, thresholds, limitations, and following `Version identity` section remain readable.
- Document scroll width is 1429px inside a 1440px viewport; no horizontal overflow.

Screenshots:

- `methodology-desktop-light.png`
- `methodology-desktop-dark.png`

## Mobile — 390 × 844

- Light and dark themes retain a 339px editorial reading column.
- The heading, code identifier, long paragraphs, and percentages wrap without clipping.
- Document scroll width is 379px inside a 390px viewport; no horizontal overflow.
- Header and theme controls remain usable.

Screenshots:

- `methodology-mobile-light.png`
- `methodology-mobile-dark.png`

## Runtime

The browser console returned no warnings or errors after theme and viewport changes.
