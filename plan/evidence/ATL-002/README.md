# ATL-002 evidence

ATL-002 extends the generated Atlas operational-coverage report from nine to
all 14 declared data domains.

## Result

- The checked live snapshot covers 194 sovereign-state jurisdictions.
- Five domains meet the declared 80% coverage/completeness and 180-day
  freshness minimums.
- Nine domains remain `Attention`, with 14 concrete alerts.
- Every domain records its denominator, record count, jurisdiction coverage,
  field completeness, source families, last successful run, known gaps,
  thresholds, release-readiness standing, and required public behavior.
- Below-threshold domains remain visible on `/methodology/source-coverage` and
  `/api/source-coverage` with warnings; they cannot be described as complete.
- The separate fact-provenance report continues to own resolver/source-depth
  measures, avoiding a false merger of operational and reconciliation
  coverage.

## Browser QA

- Chromium rendered all 14 domain sections in both light and dark mode.
- The page had no horizontal overflow at 1800 × 1043 or 390 × 844.
- The release-readiness disclosure was present in the rendered page.
- No Civica console errors or warnings were observed. The captured warnings
  came from an installed browser-wallet extension.
- Captures: `source-coverage-dark-desktop.png`,
  `source-coverage-light-desktop.png`, and
  `source-coverage-light-mobile.png`.

## Verification

```sh
npm run generate:source-coverage
npm run validate:source-coverage
npm run audit:source-coverage:live
npm run generate:atlas-surface-data-matrix
npm run validate:atlas-surface-data-matrix
npm run validate:design-tokens
npx tsc --noEmit
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

No source timestamp or missing field was inferred. The report retains weak
domains and exact alerts rather than adjusting thresholds after seeing the
results.
