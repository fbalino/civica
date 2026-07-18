# ATL-015 — Source-native Atlas map layers

**Date:** 2026-07-18
**Status:** complete

## Decision

The Atlas map now presents only two categorical publisher-native variables:

1. **Regime type (V-Dem)** — the retained V-Dem Regimes of the World
   observation.
2. **Income group (World Bank)** — the retained World Bank Country
   Classifications observation.

The prior map-only government classifier was removed because it grouped
country prose through Civica-maintained rules rather than displaying a
publisher-native variable. Civica Index and Pulse layers are absent; neither
is silently represented by map colour.

## Reader contract

- Every active layer shows its source link, `SourceDot`, retained upstream
  vintage, categorical legend, and a layer-specific explanation of `No data`.
- `/atlas?layer=regime` and `/atlas?layer=income` restore the selected layer;
  the V-Dem regime default remains the clean `/atlas` URL.
- The keyboard-accessible table alternative is generated through the same
  `tooltipValueForLayer()` resolver as the choropleth. A country therefore
  cannot have one displayed map value and another table value.
- The table lists the country profile link, active native variable, and
  observed/no-data state. It is intentionally not a ranking.

## Verification

- `src/lib/atlas/map-layers.test.ts` proves that only V-Dem and World Bank
  layers are accepted, deprecated Index/Pulse/government parameters fall back
  to the source-native default, and map/table values preserve missingness.
- `e2e/atl-015-source-native-map.spec.ts` passes desktop and small-mobile in
  light and dark themes, validates the source/vintage/missingness register,
  opens the table with the keyboard, and checks the resulting table.
- The existing `e2e/qa-010-reader-journeys.spec.ts` Atlas journeys also pass
  against the source-native default.
