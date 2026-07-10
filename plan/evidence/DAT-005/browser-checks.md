# DAT-005 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with the in-app browser.

## Reader report

- `/methodology/provenance-coverage` returned HTTP 200 with the canonical
  methodology layout and sidebar.
- The page rendered all four summary/statement/fact-key/country tables, the
  17,516 fact-group total, the 2,349 conservative independence count, the
  explicit DAT-006 limitation, and the machine-readable link.
- At the default desktop viewport, document width stayed inside 1280px.
- At 390×844, document width stayed at 379px inside the 390px viewport. All
  four tables used internal `overflow-x: auto`; the two wide breakdowns did not
  widen or clip the page.

## Machine report and runtime health

- `GET /api/provenance-coverage` returned HTTP 200 with schema
  `fact-provenance-coverage/v1`, 17,516 facts, 17,516 linked facts, 13,201
  single-source facts, 2,349 two-plus-independent facts, zero unresolved
  disputes, zero stale live rows, 253 country/area rows, and 88 fact-key rows.
- Browser logs contained no warnings or errors.
