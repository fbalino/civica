# QA-016 browser-check log

Date: 2026-07-18. Environment: detached production build on local port 3101.

## Credential-free reader matrix

`E2E_BASE_URL=http://localhost:3101 npm run test:e2e:browser-support`

- Chromium: home navigation, accessibility disclosure, Record, and
  no-JavaScript home/Record passed.
- Firefox: the same two critical-reader and no-JavaScript journeys passed.
- WebKit: the same two critical-reader and no-JavaScript journeys passed.
- Result: 6 passed, 12 skipped (the four controlled, data-backed simulations
  are intentionally unavailable without the fixture database).

## Controlled failure matrix

`E2E_BASE_URL=http://localhost:3101 E2E_PERFORMANCE_FIXTURE_DB=1 npm run test:e2e:browser-support`

- Chromium: all reader/no-JavaScript checks plus blocked Atlas geometry CDN,
  failed country-map canvas initialization, blocked Commons portrait, and
  intercepted Ask Civica `503` passed.
- Firefox/WebKit: critical reader/no-JavaScript checks passed; the controlled
  dynamic fixtures are intentionally Chromium-only because their support
  purpose is a single deterministic failure simulation, not a browser-coverage
  claim.
- Result: 10 passed, 8 skipped.

Screenshots inspected: `browser-support-chromium.png` and
`record-no-js-chromium.png`.
