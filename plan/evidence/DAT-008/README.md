# DAT-008 — Source freshness semantics

## Outcome

Source freshness now means that a production writer successfully committed at
least one row and then successfully updated the registered source through the
single sanctioned helper. Invalid or non-writing runs cannot stamp freshness.

## Acceptance evidence

- `src/lib/db/source-freshness.ts` rejects dry runs, non-positive or non-safe-
  integer row counts, blank source IDs, and invalid timestamps before issuing an
  update. Source IDs are trimmed, deduplicated, and stamped in one statement.
- `src/lib/db/source-freshness.test.ts` contains 11 behavioral fixtures covering
  dry, zero-row, negative, `NaN`, infinite, fractional, blank-ID, successful
  single-source, successful multi-source, invalid-time, and executor-failure
  paths.
- `scripts/validate-sync-freshness.ts` scans all production source files for
  direct property sets, upsert updates, and raw SQL writes outside
  `markSourcesSynced()`. Its own six seeded scanner fixtures prove three
  violations are detected and three safe controls remain accepted.
- `npm run validate:sync-freshness`, the focused test file, TypeScript, the
  master-plan validator, and the full production build pass.

## Scope note

This is a library and enforcement-gate change with no rendered UI. Browser
verification is therefore not applicable.
