# ATL-016 — Separate Conditions comparison surface

## Status

Complete. `/compare` includes a Conditions section that reads the same
single immutable release as the Conditions explorer and country page. It
reuses the country-panel presentation, so every comparison retains the native
component, unit, source name, reference year, and value/missingness state.

## Enforced behavior

- The comparison makes no cross-country or cross-dimension rank, normalization,
  or combined score claim.
- It explicitly warns that reference years may differ across countries or
  conditions.
- Economic Stability is a source-native component ledger only. The public
  release contract rejects an economic normalized score, and the three public
  Conditions surfaces show `No composite published`.
- `npm run validate:conditions-components` now checks that the explorer,
  country panel, and comparison surface retain this contract.

## Completion evidence

The isolated QA-018 Preview published
`conditions-qa018-20260726-v2` and exercised a three-country comparison plus
the explorer and country panel at desktop and 390px mobile widths. The retained
packet covers aligned, mixed-year-refused, and missing-component rows with no
horizontal overflow or console errors:

- `plan/evidence/ATL-016/release-browser-reconciliation.v1.json`
- `plan/evidence/ATL-016/browser-evidence.v1.json`
- `plan/evidence/ATL-029/release-reconciliation.v1.json`

This completes the task's staging-verifiable acceptance criteria. Production
migration/publication remains separately owned by ATL-026 and ATL-027.
