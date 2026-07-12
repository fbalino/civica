# ATL-005 — neutral country evidence coverage

Completed 2026-07-12.

## Result

Every country Civica Data page now opens with an Evidence Coverage section.
The section describes the evidence Civica holds for that country or area; it
does not grade the country, its government, or its institutions.

The view keeps nine properties separate instead of combining them into a
confidence score:

- held and missing supported fact-key groups;
- source linkage;
- one-source groups;
- groups with two or more independent producing families;
- current multi-source agreement and resolver-selected differences;
- unresolved disputes; and
- stale live rows.

Missing checked coverage and an unavailable live resolver are named states.
Neither becomes zero, a midpoint, or a country-quality inference.

## Metric trace

- Held groups, source linkage, one-source groups, producing-family depth,
  unresolved disputes, and stale rows come directly from the checked DAT-005
  `FactCoverageReport.byCountry` row.
- The missing-group count is the full closed DAT-006 fact-key registry minus
  the DAT-005 held-group count. Resolver support is a separate policy property;
  an unsupported key is not silently removed from evidence missingness.
- Producing-family depth uses DAT-005's DAT-006 source-independence rules, so
  republishers collapse to their upstream producer and projections do not
  manufacture corroboration.
- Agreement and selected differences use the current DAT-006/DAT-007 resolver
  output. Only fact groups with at least two eligible source IDs enter that
  denominator.
- The page visibly separates the dated checked snapshot from the live resolver
  query and links to both full methodology surfaces.

The new module is registered in
`civica-atlas-surface-data-matrix/v1`, bringing the checked inventory to 39
route/module rows.

## Browser verification

- Japan Civica Data opened directly to Evidence Coverage at 1422px desktop.
- Light and dark themes rendered the section without page-level horizontal
  overflow.
- The page stated both “does not grade the country” and “No combined confidence
  score is calculated.”
- All nine evidence-property rows rendered with their stated denominators.
- The final denominator wording was also verified in server-rendered output as
  `current multi-source groups` after the browser-discovered correction.

## Automated verification

- Focused country-coverage, DAT-005, and source-independence tests passed.
- TypeScript and targeted ESLint passed.
- Design-token, numeric-claim, Atlas surface-matrix, claims/documentation, and
  Index change-control gates passed.
- The complete production build passed.
