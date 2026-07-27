# PUL-035 migration evidence

Migration: `0027_smart_tempest`

- Zero-write production planning found 27 applied authoritative migrations,
  one pending migration, and 71 public tables.
- The complete 28-file chain applied to a clean PostgreSQL 17 database.
- A seeded `democratic_quality` projection backfilled to immutable history with
  a 365-day window. The history trigger rejected an update, and the new
  dimension constraint rejected the obsolete `dq` abbreviation.
- The clean database produced the expected 72-table schema fingerprint
  `79dc9062ac22f342d681aa0c05670ca49ba2b60f9d7ce99d8ea69940f0baf4bb`.
- Production applied 20 statements and matched that fingerprint.
- The post-migration live validator found 325 current rows, 650 immutable
  outputs, two score runs, and zero lifecycle invariant failures.

The migration preserves all current dimensional rows, backfills them into
history, and adds no destructive statement. Recovery uses the isolated
pre-change backup or a reviewed forward compensation; history rows cannot be
updated or deleted.
