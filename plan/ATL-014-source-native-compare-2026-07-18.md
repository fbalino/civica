# ATL-014 — Source-native Compare evidence

**Date:** 2026-07-18
**Status:** complete

## Scope

Make `/compare` an evidence comparison rather than a country scorecard.
The route keeps its ordered repeated `c` parameters as the stable shared
selection. It compares only like-for-like publisher-native measures and makes
the source, publisher vintage, definition, unit, missingness, and export
rights visible for each selected country.

## Acceptance contract

- The public Compare page imports and renders no Civica Index component or
  Index score. Its overview does not select or emphasize a highest numeric
  value.
- Governance evidence remains one publisher-native observation per row, with
  its release and native scale. Longitudinal history is selected by both
  source and indicator, so different publisher series cannot be blended.
- Each history country card exposes its retained publisher vintage(s),
  observed range or an explicit absence state, and source-specific JSON/CSV
  download links when the applicable source rights permit redistribution.
- Chamber compositions identify the immutable source-bound composition run;
  no recorded run renders as a provenance gap, not an empty legislature.
- Ordered `?c=` selections survive reload and the evidence controls remain
  usable in desktop/small-mobile and light/dark browser checks.

## Boundaries

- No database migration, production write, release publication, deployment,
  or paid-model call is part of this task.
- Civica Conditions remains a separate contextual section. Its release
  publication prerequisite is owned by ATL-016 and is not represented as a
  substitute score here.

## Verification

- Focused query, comparison-contract, and indicator-lineage tests pass.
- TypeScript, design-token, Atlas-matrix, Index-disposition, and claims/docs
  validation pass.
- An isolated local Chromium run passed desktop and small-mobile in light and
  dark themes. The existing 11-journey reader regression suite also passes.

See `plan/evidence/ATL-014/` for the complete evidence and captured mockups.
