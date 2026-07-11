# DAT-031 evidence — explicit live and frozen fact reads

## Contract

The country list, country detail, and country research export require an explicit `as_of` query. `live` selects current resolver rows and cannot emit a vintage label or cutoff. A complete existing immutable vintage label selects only `country_fact_vintages`; an absent frozen value remains null and cannot borrow the current jurisdiction cache. JSON and CSV carry the selection metadata.

## Live proof

- Missing list selection: HTTP 400.
- `as_of=live`: HTTP 200 with `mode=live`, `vintage=null`, `cutoffAt=null`, and a resolver-row retrieval horizon.
- `Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1`: HTTP 200 with the exact label, one row-derived cutoff, source retrieval horizon, and `v0.2-beta` method.
- Complete nonexistent `2099-Q4` label: HTTP 400.
- The selected Q1 vintage contains 17,506 rows at one cutoff.
- Albania inflation is `2.1461854` live and `2.2158737` frozen, proving a current post-cut value does not leak into the historical selection.

## Verification

- `npm run validate:fact-read-selection` — pass.
- `npm run validate:fact-read-selection:live` — pass.
- `npm run validate:api-docs` — pass.
- `npm run validate:claims-docs` — pass, including 647/647 tests.
- `npm run build` — pass.
- Local API-docs browser render showed the required selector and produced no console errors.

## Remaining boundary

The Q1 snapshot contains canonical winners. DAT-032 owns freezing the complete candidate observation set and offline replay; this task does not claim that alternates are already fully frozen.
