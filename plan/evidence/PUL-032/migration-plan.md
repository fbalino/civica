# PUL-032 migration and recovery plan

## Forward change

- Artifact: `drizzle/authoritative/0024_dark_maginty.sql`
- Adds `pulse_cluster_classification_states` and
  `pulse_classification_attempts` with restrictive foreign keys, closed shape
  checks, one state per cluster/configuration, and one attempt phase per
  cluster/configuration/ordinal/outcome.
- Backfills only event, non-event, and invalid outcomes proved by retained
  rows. Historic provider failures, call counts, and actual environment
  overrides remain unknown.
- Adds synchronous research-history retention to the mutable state projection,
  a terminal/identity transition guard, and an update/delete rejection trigger
  to the attempt ledger.

## Preflight and application

- `npm run db:plan -- --all --live` recorded zero writes and exact pre-change
  row counts in `plan/evidence/DAT-013/preflight.json`.
- The complete 25-migration path ran successfully on a fresh PostgreSQL 17
  database before production application.
- Production applied migration 0024 after 24 recorded migrations. The final
  71-table schema matches fingerprint
  `3f108a531f90f96397a0cd387fca41fcccd0c3862ef16e4535355ecc99501283`.
- Migration and backfill invoked no classifier, provider API, or other model.

## Recovery

Do not delete attempt evidence or reverse terminal rows in place. Restore an
isolated pre-change backup when full rollback is required. A production repair
must be a reviewed forward migration that preserves the 0024 ledger and
records its reason, actor, and affected state. A bad retry policy or queue
configuration can be stopped by disabling the classification cron without
changing retained evidence.
