# CLM-013 browser checks

Status: **PASS**

- Fresh production build served at `http://localhost:3100`
- Browser: headless Google Chrome through Playwright
- Desktop: `1440 × 1000`, light theme, reduced motion
- Mobile: `390 × 844`, dark theme, reduced motion

## Sample routes inspected in a real browser

- `/`
- `/civica-index`
- `/civica-index/methodology/pulse`
- `/compare?c=france&c=germany`
- `/country/france/civica-data`
- `/country/france/constitution`

## Assertions

- Every sample returned HTTP 200 with exactly one apex canonical and one matching `og:url`.
- Query parameters survived HTML entity encoding and DOM parsing on the comparison canonical.
- Index, comparison, and country Civica Data metadata visibly state research-Beta posture.
- Pulse metadata identifies an experimental event ledger and avoids a live/continuous-measure claim.
- The Index page exposes one parseable Dataset node with apex creator, publisher, license, and JSON distribution; its real database vintage is retained.
- Both themes honor reduced motion, have no document-level horizontal overflow, and generated no console or page errors.

## Screenshots

- `index-metadata-desktop-light.png`
- `pulse-metadata-mobile-dark.png`
