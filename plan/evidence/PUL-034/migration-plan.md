# PUL-034 migration and recovery plan

## Forward change

- Artifact: `drizzle/authoritative/0026_magenta_xavin.sql`.
- Preflight records zero rows in `pulse_daily_scores` and zero rows in
  `pulse_changelog`, with no writes.
- The migration checks that both relations exist, counts both inside the
  migration transaction, and raises an exception unless both counts are zero.
- It drops the two empty v1 output relations without `CASCADE`.
- It leaves the 462-row `pulse_events` evidence table unchanged.
- The Drizzle schema, generated snapshot, authoritative manifest, schema
  fingerprint, data dictionary, and production migration ledger move together.

## Verification

- A clean PostgreSQL fixture must drop both empty relations.
- A fixture with one scalar row must abort and retain the row and relation.
- The complete authoritative path must build on an empty PostgreSQL database.
- Production must record 27 of 27 authoritative migrations, expose 71 public
  tables, match the checked fingerprint, report both retired relations absent,
  and retain all legacy event rows.
- Route tests must prove stable `410` bodies and no-store headers for every CP
  casing and legacy embed form; unknown sort values remain `400`.

## Recovery

No empty output relation contains evidence to restore. If later investigation
finds a legitimate need for the table shape, add a reviewed forward migration
with a new name and contract; do not edit migration 0026 or revive the scalar
method. A failed production migration performs no drop because all statements
and the ledger insert run in one transaction. A broader schema problem uses
the isolated pre-change backup or a reviewed forward compensation. The retained
legacy event rows must not be deleted or relabelled during recovery.
