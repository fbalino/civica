# DAT-006 browser checks

Checked locally on 2026-07-10 at `http://localhost:3001` with Chromium through
Playwright.

## Reader report

- `/methodology/provenance-coverage` returned HTTP 200.
- The reconciliation section rendered all four current policy counts and the
  claim-lineage explanation inside canonical methodology/DataTable primitives.
- Full-page desktop (1440×1000) and mobile (390×844) screenshots completed.
- Wide fact-key and country tables stayed inside their horizontal-scroll
  containers at mobile width; no page-level clipping was visible.

## Machine report and runtime health

- `GET /api/reconciliation-audit` returned HTTP 200 with schema
  `reconciliation-coverage/v1`, 129 fact-key policies, and zero unverified
  active relationships.
- Local dev logs showed the existing footer country-search hydration warning
  involving a transient `caret-color` style. No DAT-006 component appears in
  the warning, and the production build is clean; this is not recorded as a
  DAT-006 acceptance failure.
