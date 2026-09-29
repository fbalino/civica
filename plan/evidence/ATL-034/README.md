# ATL-034 — Unattributed legislature seats

**Status:** complete (P0) · **Date:** 2026-09-29 · **Branch:** `claude/fix/unreported-legislature-seats`

## Outcome

The canonical hemicycle (`FactbookLegislatureChart`) drew every seat that the
party rows did not cover in the colour of the last, smallest party. A seat the
composition source does not attribute to any party therefore looked like a
seat held by that party, which contradicted the page's own disclosure that the
hemicycle is a reading of the exact chamber-party rows.

The chart now fills seats from the party rows through one shared helper,
`attributeSeats` in `src/lib/legislatures/seat-attribution.ts`, and draws the
remaining seats in a new design-system **unattributed seat state**:

- Tokens `--color-seat-unattributed` and `--color-seat-unattributed-ring`
  (defined in both the light `:root` block and the `[data-theme="dark"]` block
  of `src/app/globals.css`) and `--stroke-seat-unattributed`. The seat is an
  open neutral seat: a quiet fill inside a muted ring. It never takes a party
  colour.
- Unattributed seats carry no party id, so they are never dimmed or selected
  with the Party browser rows.
- Hover tooltip: "No party reported" plus the seat number.
- A key under the hemicycle, "No party reported · N seats", appears only when
  N is above zero.
- The SVG accessible description counts them ("…; No party reported, 1 seat.").
- The composition table in the research disclosure gets a "No party reported"
  row per affected chamber, and the disclosure copy explains the state.
- Shown on `/design-system`: a "Legislature seats" swatch group and a sample
  chamber reporting 146 party seats in a 150-seat chamber (4 unattributed).
- Documented in `DESIGN.md` (hemicycle paragraph and front-matter tokens) and
  in the research visualization contract's missingness statement.

**Party rows above the statutory total.** The drawing still stops at the
statutory total, so no seats are invented and nothing overflows. The
accessible description now says so ("The party rows add up to 54 seats, more
than the chamber's 50; the drawing shows 50 seats."). The Party browser still
lists every row as reported. The upstream data is not changed here.

The ATL-033 majority helper (`src/lib/legislatures/majority.ts`) is unchanged
and still drives every majority line.

## Live impact (read-only production query, 2026-09-29)

The query replicated the country-page chamber builder
(`getLegislatureForJurisdiction`: lower/upper body selection, current party
rows, and the existing 1.2x aggregation normalisation) over every legislative
body. SELECT-only; no writes.

| Measure | Chambers | Seats |
| --- | ---: | ---: |
| Rendered chambers | 280 | |
| Party seats below the statutory total | 182 | 17,583 unattributed |
| · with some party rows (previously painted in the smallest party's colour) | 96 | 4,449 |
| · with no party rows (previously an empty, rostrum-only hemicycle) | 86 | 13,134 |
| Party seats above the statutory total (drawing stops at the total) | 9 | |

Examples with party rows: Uruguay Senate 30 of 31 (16/9/5; the Colorado Party
was drawn with 6), Japan House of Councillors 125 of 248, Somalia House of the
People 9 of 275, South Sudan Transitional Assembly 29 of 550, Uganda 294 of
529, Syria 22 of 210, Iran 142 of 290, Mauritania 1 of 176.

Examples with no party rows, now drawn fully unattributed with the key
"No party reported · N seats": Switzerland National Council 200 and Council of
States 46, Brazil Chamber of Deputies 513 and Federal Senate 81, Kenya National
Assembly 350, Nigeria House of Representatives 360, Poland Sejm 460.

Chambers whose party rows exceed the total (unchanged data, now disclosed in
the accessible description): Colombia House 188/183 and Senate 108/103,
Philippines House 318/317, New Zealand House 123/120, Solomon Islands 54/50,
and, after the loader's aggregation normalisation rounds up, DRC Senate
112/109, Saint Lucia Senate 12/11, Jamaica Senate 22/21, Slovenia National
Council 41/40.

## Tests

New file `src/components/factbook/legislature-unattributed-seats.test.ts`
(`node:test` + `renderToStaticMarkup`):

1. Uruguay-shaped Senate (16 + 9 + 5 of 31): 31 seats, exactly 16/9/5 party
   seats counted by painted colour, exactly 1 unattributed seat with the state
   class.
2. Key and accessible description read "No party reported · 1 seat" /
   "Partido Colorado, 5 seats; No party reported, 1 seat."
3. Parties summing to the total (48 + 42 + 9 of 99): no unattributed seat, no
   key, no "No party reported" text.
4. Parties above the total (30 + 20 + 4 of 50): exactly 50 seats, no extra or
   unattributed seats, disclosure sentence present, no crash.
5. No party rows (46 seats): 46 unattributed seats and the key.
6. `attributeSeats` unit cases: under, exact, over, malformed (negative, NaN,
   fractional) seat counts, and a zero-seat chamber.

**Fails on the old code.** With `FactbookLegislatureChart.tsx` restored from
`origin/main` (`ebeb74e1`) and the new tests unchanged:
`node --import tsx --test src/components/factbook/legislature-unattributed-seats.test.ts`
exited 1 with 4 failures and 2 passes. Test 1 failed with
`actual: 6, expected: 5` (Colorado seats); tests 2, 4 and 5 also failed
(test 5: `actual: 0, expected: 46`). Tests 3 and 6 pass on both, as intended
regression guards. With the new chart restored the file passes 6/6.

## Commands and exit codes

| Command | Exit | Result |
| --- | ---: | --- |
| `node --import tsx --test src/components/factbook/legislature-unattributed-seats.test.ts src/components/factbook/legislature-majority.test.ts src/lib/research/visualization-contract.test.ts` | 0 | 15/15 pass |
| same new test file against the old chart | 1 | 4 fail / 2 pass (expected) |
| `npm test` | 0 | 2,288 tests: 2,285 pass, 0 fail, 3 skipped |
| `npm run validate:design-tokens` | 0 | no new drift; baseline unchanged |
| `npm run validate:design-composition` | 0 | pass |
| `npm run validate:ui-pattern-map` | 0 | pass |
| `npm run validate:rendered-module-ledger` | 0 | 1,982 entries, ledger current |
| `node plan/tools/validate-master-plan.mjs` | 0 | 314 total, 269 complete, 45 remaining, 85.7% |
| `npm run generate:readiness-reports` | 0 | regenerated gate reports |
| `npm run validate:readiness-reports` | 0 | pass |
| `npm run validate:remaining-work-report` | 0 | 45 open tasks classified once |
| `npm run validate:operations-readiness` | 0 | pass (G4 still blocked, as before) |
| `npm run validate:lint` | 0 | no new lint errors (pre-existing ratchet notices only) |
| `npm run typecheck` | 0 | pass |
| `npm run validate:module-coverage` | 0 | 8/8 modules meet thresholds |
| `npm run validate:secrets` | 0 | pass |
| `npm run build:ci` | 0 | production build completed |

## Visual baselines (human gate — not approved here)

No new visual baselines were approved. The QA-013 visual-regression cases that
render hemicycles will differ from their checked snapshots once this ships and
need an owner review before re-approval:

- `country-civica-data` (`/country/switzerland/civica-data`): both Swiss
  chambers have no party rows, so they change from a blank rostrum-only
  hemicycle to 200 and 46 open neutral seats with the key.
- `compare` (`/compare?c=france&c=japan`): Japan's House of Councillors
  changes from 123 seats in the smallest party's colour to 123 unattributed
  seats.

`/design-system` has no checked visual baseline; its sample chamber now shows
4 unattributed seats.

## Browser evidence

Local development server on this branch, 2026-09-29, reading the production
database read-only:

- `uruguay-senate-desktop-dark.jpg`: `/country/uruguay/civica-data` Senate
  draws 16 / 9 / 5 party seats and one open neutral seat, with the key
  "No party reported · 1 seat". The House draws 99 of 99 attributed seats and
  no key.
- `switzerland-council-of-states-desktop-light.jpg`:
  `/country/switzerland/civica-data` draws both chambers fully neutral, with
  keys "No party reported · 200 seats" and "No party reported · 46 seats".
- Rendered-markup checks on the same server: Somalia draws 275 and 54 seats
  with keys for 266 and 45 unattributed seats; Solomon Islands draws exactly
  50 seats with no key and no overflow; `/design-system` draws 150 seats with
  the key "No party reported · 4 seats".
- No hydration or runtime errors were logged after reloading the Switzerland
  page.

## Follow-ups (not changed here)

- Upstream data for the 9 chambers whose party rows exceed the statutory
  total (Colombia House and Senate, Philippines House, New Zealand House,
  Solomon Islands, and the normalised DRC, Saint Lucia, Jamaica, and Slovenia
  upper chambers). The loader's 1.2x normalisation can round up past the
  total; the other five are unnormalised source sums.
- The 86 chambers with a statutory total but no party rows are a composition
  ingest gap; they now read honestly but still lack party data.
- Where the source does report why a seat is unattributed (vacant, presiding
  officer, appointed), a later task could name the reason instead of the
  generic "No party reported".
- `/compare` falls back to `var(--color-text-40)` for a party row with no
  colour, which is visually close to a neutral seat; `resolvePartyColor` is
  not used there.
- The ATL-033 follow-ups (duplicated chamber builders, the dead
  GovStructureDiagram, cramped /compare chamber cards on phones) remain open.
