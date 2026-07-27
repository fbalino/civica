# ATL-015 evidence — Source-native Atlas map layers

**Captured:** 2026-07-18

## Delivered contract

- The map switcher exposes V-Dem regime type and World Bank income group only.
  It has no Civica Index, Pulse, or derived government-classifier layer.
- The loader passes the retained source identity, source freshness, upstream
  vintage, and source URL to the client with the layer values.
- Legends disclose publisher, vintage, categorical meaning, and the precise
  `No data` behavior.
- The reader table alternative resolves its values through the same function
  as map hover/colour selection, then exposes country profile links and an
  explicit availability column.

## Verification

```sh
node --import tsx --test src/lib/atlas/map-layers.test.ts src/lib/atlas/surface-query-state.test.ts src/lib/atlas/atl-018-country-reader.test.ts
npx tsc --noEmit
npm run validate:design-tokens
npm run validate:atlas-surface-data-matrix
ATL015_CAPTURE_DIR=plan/evidence/ATL-015/mockups E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/atl-015-source-native-map.spec.ts
E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/qa-010-reader-journeys.spec.ts
```

The ATL-015 fixture passed all four desktop/small-mobile × light/dark
scenarios. It waits for rendered country geometry, checks source/vintage and
missing-data explanations, then opens the table alternative from the keyboard.
The QA-010 regression suite passed all 11 reader journeys. The tests fail on
all browser hard errors; no exception was applied for this task.

## Screenshots

- `mockups/atlas-income-desktop-light.png`
- `mockups/atlas-income-desktop-dark.png`
- `mockups/atlas-income-small-mobile-light.png`
- `mockups/atlas-income-small-mobile-dark.png`
- `mockups/atlas-income-table-desktop-light.png`
- `mockups/atlas-income-table-desktop-dark.png`
- `mockups/atlas-income-table-small-mobile-light.png`
- `mockups/atlas-income-table-small-mobile-dark.png`
