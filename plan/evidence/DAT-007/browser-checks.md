# DAT-007 browser and API checks

Checked locally on 2026-07-10 at `http://localhost:3001` with Chromium through
Playwright.

## Methodology page

- `/country/methodology/reconciliation` returned HTTP 200.
- The resolver section states the adopted `source-precedence/v1` contract and
  the six decision-trace categories.
- The ONS example now states the current native-office tie rule rather than the
  stale “freshness alone” rule.
- Full-page desktop (1440×1000) and mobile (390×844) screenshots rendered
  without visible clipping or layout regression.

## Live API

- `GET /api/v1/countries/ARG` returned HTTP 200.
- `data.provenance.population.source` was `un_data`.
- The provenance object contained all six ordered trace codes and ended with:
  “un_data was selected as the measured canonical (as of 2024-01-01) under
  source-precedence/v1.”
- The unrelated footer country-search `caret-color` hydration warning remains
  visible in local dev logs; no reconciliation component appears in it.
