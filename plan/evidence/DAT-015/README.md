# DAT-015 — Explicit data-value states

## Outcome

DAT-015 is complete. `data-value-state/v1` defines seven closed states:
`observed`, `missing`, `unknown`, `not_applicable`, `not_observed`, `disputed`,
and `withheld`.

- Observed and disputed rows require a value.
- The five absence states forbid a value and require a reason.
- Observed zero remains a real value; blank strings and display dashes never
  stand in for unknown data.
- Public country facts and Index dimensions carry explicit status metadata.
- The shared renderer gives every state distinct output.
- Indicator history retains disputed values and records every absence.
- Future export schemas preserve status and reason.

## Storage and live migration

Migration `drizzle/migrations/0023_data_value_states.sql` added constrained
status/reason columns to `country_facts`, `indicator_history`, and
`country_metrics`, and made the two indicator value columns nullable.

The migration was applied transactionally to the live Neon database:

- 25,827 country-fact rows migrated as observed
- 46,215 indicator-history rows migrated as observed
- 7,449 country-metric rows migrated as observed
- 79,491 total rows
- zero invalid rows in all three tables after migration

`npm run validate:data-value-states:live` verifies both repository closure and
the live constraints. DAT-013 migration preflight now covers 37/37 artifacts.

## Acceptance evidence

- `src/lib/data/value-state.test.ts`: seven fixtures cover distinct storage,
  zero/blank handling, country API precedence, indicator grouping, exports,
  shared UI, and all three migration constraints.
- `npm test`: 607/607 passed.
- `npm run build`: passed, including claims/docs, migration, dictionary,
  release-quality-report, API-contract, and design-token gates.
- `npx tsc --noEmit`: passed.
- Targeted ESLint: zero errors; one unrelated existing unused-variable warning.
- `npm run validate:data-value-states:live`: passed with zero invalid live rows.
- `npm run validate:api-docs`, `validate:data-dictionary`,
  `validate:migrations`, `validate:migration-preflight`,
  `validate:release-quality-report`, and `validate:design-tokens`: passed.

## Browser and API checks

- `/design-system` rendered all seven states distinctly, including an observed
  numeric value and a disputed numeric value with its status chip.
- `/api-docs` rendered the complete state list and explicitly said that zero
  remains observed and null does not stand in for zero.
- `/country/france/civica-data` rendered successfully with no console errors or
  warnings in a clean browser tab.
- A live local request to `/api/v1/countries/france` returned 11 fact-status
  entries; population and the first Index dimension were explicitly observed.

## Remaining work

DAT-016 has not started. The owner requested a pause immediately after this
task. DAT-014's separate live data-quality blockers remain assigned to DAT-028
and DAT-029.
