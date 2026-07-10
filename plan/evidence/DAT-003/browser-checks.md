# DAT-003 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser.

## Licensing registry

- `/licensing#rights-manifest` rendered the version label, source table,
  product table, field-class table, release-artifact table, and link to the
  machine-readable endpoint.
- At the default desktop viewport, the document width stayed within the
  1280px viewport.
- At 390×844, the first check exposed clipped wide tables. `DataTable` was
  repaired to use the canonical `.editorial-table-scroll` wrapper. The repeat
  check showed a 379px document inside the 390px viewport, with all four tables
  scrolling internally (`overflow-x: auto`) instead of widening the page.

## API documentation and routes

- `/api-docs#bulk-data` explains that the country JSON/CSV download is withheld,
  shows the strict 503 response, identifies DAT-017/DAT-027 as the replacement
  gate, and states that no supported bulk-download workaround exists.
- `GET /api/rights-manifest` returned HTTP 200 with schema
  `rights-manifest/v1`, 43 sources, 2 products, and 1 release artifact.
- `GET /api/countries/france/export?format=json` returned HTTP 503 with
  `EXPORT_RIGHTS_BLOCKED`, `/api/rights-manifest`, and `DAT-017/DAT-027`.
- Browser logs contained only normal React development and HMR messages; no
  runtime error was observed.
