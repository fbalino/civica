# ATL-016 — Separate Conditions comparison surface

## Status

In progress. `/compare` now includes a Conditions section that reads the same
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

## Remaining evidence before completion

1. Apply the Conditions release migration to isolated staging and publish a
   captured immutable release.
2. Exercise the compare route with two and three countries from that release
   in the browser, including aligned, mixed-year-refused, and missing-component
   rows, at desktop and mobile widths.
3. Store the release ID, manifest hash, screenshots, and validation output in
   `plan/evidence/ATL-016/`, then update the master checklist.
