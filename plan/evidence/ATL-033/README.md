# ATL-033 — legislature absolute-majority threshold

Completed 2026-09-28.

## Outcome

- Every rendered legislature majority threshold now comes from one shared,
  tested helper, `src/lib/legislatures/majority.ts`:
  `absoluteMajorityThreshold(totalSeats)` returns `floor(totalSeats / 2) + 1`
  (the absolute majority of statutory membership) and returns null for a total
  that is not a positive safe integer. `holdsAbsoluteMajority(seats, total)`
  compares a seat count against that threshold.
- The canonical hemicycle (`FactbookLegislatureChart`) uses the helper for the
  SVG `MAJORITY n` label and the stats-grid "Majority line". The label is
  omitted, and the stats grid shows its existing `—` fallback, when no valid
  threshold exists.
- `ChamberComposition` uses the helper for its "Majority line" cell, the
  balance-bar aria-label and tick position, and the "Working majority" /
  "No single-bloc majority" badge. The badge is still shown only when governing
  coalition seats are flagged.
- The country Civica Data legislature section, `/compare` chambers, and the
  `/design-system` hemicycle all render through `FactbookLegislatureChart`, so
  the correction reaches all three surfaces.
- The previous `Math.ceil(total / 2) + 1` formula was one seat too high for
  every odd-seat chamber. The statutory `total_seats` basis is unchanged, and no
  data was repaired or rewritten.

## Live impact

Read-only production query on 2026-09-28 over the chambers the country page
renders (the lower or first legislative body plus any upper body per
jurisdiction, with the same statutory-total-or-party-sum basis as the chamber
builder): 280 chambers render, and 128 of them have an odd seat total. Each of
those 128 displayed a majority line one seat too high. Examples:

| Chamber | Seats | Previously shown | Correct |
| --- | ---: | ---: | ---: |
| Uruguay House of Representatives | 99 | 51 | 50 |
| Uruguay Senate | 31 | 17 | 16 |
| France National Assembly | 577 | 290 | 289 |
| United States House of Representatives | 435 | 219 | 218 |

Even-seat chambers (for example the 100-seat United States Senate, 51) were
already correct and do not change.

The Uruguay Senate is the one clean case where a party at exactly the
threshold was shown short of it: the Broad Front holds 16 of 31 seats, which is
an absolute majority, but the old line read 17.

## Tests

- `src/lib/legislatures/majority.test.ts`: thresholds for 1, 2, 3, 11, 31, 99,
  100, 150, 155, 435, and 577 seats; null for 0, -1, NaN, Infinity, and 30.5;
  `holdsAbsoluteMajority` for 16/31, 15/31, 50/99, 50/100, 51/100, and invalid
  totals.
- `src/components/factbook/legislature-majority.test.ts`: server-rendered
  markup of the hemicycle for 31- and 99-seat chambers (stats grid, SVG label,
  composition cell), the composition badge and aria-label for a coalition of
  16 and of 15 in a 31-seat chamber, and the fallback for empty and
  non-integer totals. Five of these six render tests fail against the previous
  formula.

## Verification

All commands ran inside the ATL-033 worktree. Exit status 0 unless noted.

- `node --import tsx --test src/lib/legislatures/majority.test.ts src/components/factbook/legislature-majority.test.ts`: 9 of 9 pass
- `node --import tsx --test src/lib/research/visualization-contract.test.ts`: 3 of 3 pass
- `npm run validate:design-tokens`
- `npm run validate:design-composition`
- `npm run validate:ui-pattern-map`
- `npm run validate:rendered-module-ledger`
- `node plan/tools/validate-master-plan.mjs`: 313 tasks, 268 complete
- `npm run generate:readiness-reports`
- `npm run validate:readiness-reports`
- `npm run validate:remaining-work-report`
- `npm run validate:operations-readiness`
- `npm run validate:lint`: no new lint errors
- `npm run typecheck`
- `npm run validate:module-coverage`
- `npm run validate:secrets`
- `npm run build:ci`: all build validators and `next build` pass
- read-only production query for the live-impact counts above
- `git diff --check`

## Browser evidence

Local development server on this branch, 2026-09-28, reading the production
database read-only:

- `uruguay-senate-desktop-light.jpg`: `/country/uruguay/civica-data`, Senate
  shows `MAJORITY 16` and "Majority line 16 of 31 seats".
- `uruguay-house-desktop-dark.jpg`: same page in dark theme, House shows
  `MAJORITY 50` and "Majority line 50 of 99 seats".
- `compare-uruguay-chile-mobile-light.jpg`: `/compare?c=uruguay&c=chile` at
  375px shows Uruguay 50 and Chile 78; page width equals viewport width (no
  horizontal overflow). The same page's Senate charts read 16 (Uruguay) and 26
  (Chile, 50 seats, unchanged).

## Limitations and follow-ups

- Seats a chamber's composition source does not attribute to a party are still
  painted in the smallest party's colour in 96 chambers. That is a separate
  seat-attribution defect and is not changed here.
- Several chamber builders assemble the same `LegislatureChamber` shape in
  different places. Consolidating them is a separate cleanup.
- `src/components/GovStructureDiagram.tsx` is dead code that already used the
  correct formula; it was left untouched for a separate removal.
- On phones, `/compare` chamber cards run labels and values together (for
  example "Majority line50of 99 seats"). Production shows the same layout
  before this change, so it is a separate responsive-layout follow-up.
