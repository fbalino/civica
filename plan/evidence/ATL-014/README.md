# ATL-014 evidence — Source-native Compare

**Captured:** 2026-07-18

## Delivered contract

- `/compare?c=france&c=japan` is a stable, ordered shared selection. Compare
  contains no Civica Index panel, score, or winner-style emphasis of a numeric
  fact.
- The overview visibly distinguishes a canonical fact with its provenance dot,
  a source-labelled office holder, an explicit `No source record` legacy
  fallback, and `No value recorded`.
- The governance table retains source-native observations, publisher units,
  definitions, uncertainty, access, and publisher release. The longitudinal
  control selects both `sourceId` and indicator, lists the publisher vintage
  for every country, preserves missingness, and exposes source-specific JSON
  and CSV export links only where rights allow redistribution.
- The indicator-history endpoint now accepts an optional bounded `source`
  parameter. It applies it together with `indicator`, so an export cannot
  silently include a different publisher series with the same indicator name.
- Chamber composition reads retain the immutable `party_composition_runs`
  provenance. Compare shows the registered source release and freshness, or an
  explicit provenance gap when no source-bound run exists.

## Verification

```sh
node --import tsx --test src/lib/compare/atl-014-compare-contract.test.ts src/lib/api/request-contract.test.ts src/lib/indicators/history-catalog.test.ts
npx tsc --noEmit
npm run validate:design-tokens
npm run validate:atlas-surface-data-matrix
npm run validate:index-quarantine
npm run validate:claims-docs
ATL014_CAPTURE_DIR=plan/evidence/ATL-014/mockups E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/atl-014-source-native-compare.spec.ts
E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/qa-010-reader-journeys.spec.ts
```

The focused contract tests pass. The new browser fixture passed four
desktop/small-mobile × light/dark scenarios against an isolated local server;
it reloads the ordered share URL, rejects an Index row in the overview,
selects the World Bank WGI series, validates the publisher vintage, and checks
both country-specific source-filtered export links. The 11 QA-010 reader
journeys and the matrix, Index-disposition, design-token, and claims/docs gates
also pass.

## Screenshots

- `mockups/compare-france-japan-desktop-light.png`
- `mockups/compare-france-japan-desktop-dark.png`
- `mockups/compare-france-japan-small-mobile-light.png`
- `mockups/compare-france-japan-small-mobile-dark.png`
