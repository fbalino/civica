# ATL-018 evidence — Atlas reader data states

**Captured:** 2026-07-18

## Contract coverage

- `src/lib/atlas/surface-query-state.ts` preserves the difference between a
  successful empty result and a rejected query.
- The Factbook, Civica Data, and Constitution country-reader tabs use that
  distinction instead of silently removing a module or calling an outage an
  empty state.
- `civica-atlas-surface-data-matrix/v1` now has 40 rows, including the
  previously unregistered Conditions module.

## Verification

```sh
node --import tsx --test src/lib/atlas/surface-query-state.test.ts src/lib/atlas/atl-018-country-reader.test.ts src/lib/atlas/surface-data-matrix.test.ts src/lib/db/queries-constitution-outage.test.ts
npm run validate:atlas-surface-data-matrix
npx tsc --noEmit --pretty false
ATL018_CAPTURE_DIR=plan/evidence/ATL-018/mockups E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/atl-018-data-states.spec.ts
```

The Playwright fixture passed all four desktop/mobile and light/dark scenarios.
Its narrowly scoped console filter excludes the pre-existing `/design-system`
hydration diagnostic at `ds-ramp` / `editorial-tooltip-trigger`; it fails on
any other captured browser failure.

## Screenshots

- `mockups/2026-07-18-atlas-reader-states-desktop-light.png`
- `mockups/2026-07-18-atlas-reader-states-desktop-dark.png`
- `mockups/2026-07-18-atlas-reader-states-small-mobile-light.png`
- `mockups/2026-07-18-atlas-reader-states-small-mobile-dark.png`
