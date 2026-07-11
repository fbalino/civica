# Index series-provenance migration

## Finding

The live `ci_composite_scores` table contains eight methodology/quarter groups. Their reference periods are 2023-Q4 or 2024-Q4, while every `calculated_at` value falls in 2026. The database retains no original 2023 or 2024 Civica publication cut for those rows. Calling them historical as-published vintages would be false.

The `calculated_at` column is a PostgreSQL timestamp without a time zone. The audit converts the retained local values using the recorded `America/Montevideo` execution environment and discloses that legacy limitation. New release contracts use ISO timestamps with an offset or `Z`.

## Adopted contract

`src/lib/ci/series-provenance.ts` defines two values:

- `as_published_release` requires an original publication cut, a calculation at or before that cut, an explicit method, and a citation naming the real publication year separately from the observation period.
- `harmonized_backcast` records its later calculation time and method, has no invented historical publication cut, and says “harmonized backcast” in its citation.

The retained database value `current_harmonized_backcast_not_as_published` normalizes to the shorter public vocabulary without changing its meaning. Unknown labels fail closed.

## API, UI, and export

The deprecated Index API contract includes series provenance for each selected release. Governance Evidence displays the 2024 reference year beside its 2026 calculation status and includes the same fields in its rights-safe JSON export. Its download endpoint accepts `series_type`; the supported but unavailable as-published state returns a clear `404` with the available series list.

## Data and rollback

This migration does not rewrite stored scores or research-panel observations. The checked audit freezes the observed calculation ranges and can be compared with the live database. Rollback may remove the presentation fields only through a new Index change record; it may not restore historical as-published wording or manufacture publication cut times.
