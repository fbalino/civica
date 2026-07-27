# PUL-032 verification

Verified on 2026-07-12.

## Database and migration

- The complete 25-migration path passed on a fresh PostgreSQL 17 database.
- Production records all 25 authoritative migrations and matches schema
  fingerprint `3f108a531f90f96397a0cd387fca41fcccd0c3862ef16e4535355ecc99501283`.
- Migration 0024 backfilled 384 directly supported `classified` states and one
  retained invalid cluster as `terminal_failure`, with 385 append-only attempt
  records. The historical call count is marked `unknown_not_retained`; no
  historic provider behavior was inferred.
- Research-evidence retention passes live with 33 protected relations and
  66,303 history rows.

## Queue and retry contract

- The live queue contains 841 never-attempted eligible clusters, zero due
  retries, zero scheduled retries, and one terminal failure. Its oldest
  eligible item is dated `2026-07-06T14:08:31.054Z`.
- Seven focused tests cover terminal-none idempotence, configuration changes,
  bounded exhaustion, immediate terminal authentication failure, queue order,
  and error sanitization.
- The checked runtime contract reports method `pulse-v2.10-beta`, four closed
  states, new-before-retry ordering, a three-attempt limit, and separate
  terminal-none and terminal-failure dispositions.
- PUL-032 made zero classifier or provider model calls and did not drain the
  live backlog.

## Repository and reader checks

- `npm run validate:claims-docs`: 890 tests passed.
- `npm run validate:index-change-control`: passed at
  `civica-index-pulse-classification-state-v14` over 97 protected files and
  seven declared validations.
- `npm run validate:pulse-classification-state:live`: passed.
- `npm run validate:research-evidence-retention -- --live`: passed.
- `npm run validate:authoritative-migrations -- --live`: passed.
- `npm run validate:design-tokens`: passed with no new violations.
- `npm run build`: passed.
- `/civica-index/methodology/pulse` rendered in the local browser with the
  queue ordering, retry limits, and terminal-none distinction visible; the
  inspected page produced no console errors or warnings.
