# PUL-035 verification

Verified on 2026-07-12.

## Score lifecycle

- The focused suite passed 18 tests. It covers dry-run stability, idempotent
  projection, malformed inputs, an empty no-op, a 366-day expiry, exact
  365-day inclusion, future-event exclusion, and the deduplicated union of
  current-event and prior-state jurisdictions.
- `validate:pulse-delta-lifecycle:live` found 325 current rows across 65
  jurisdictions, 98 nonzero rows, no stale nonzero row, no incomplete
  jurisdiction, no algorithm mismatch, and no current/history mismatch.
- Production retains 650 immutable outputs across two score runs. The database
  rejected a same-value update to the append-only history table.
- Japan's country-dimensions API returned five `null` deltas under low coverage,
  with no zero or stability claim.

## Database and reproducibility

- The complete 28-migration chain applied to a clean PostgreSQL 17 database.
  A seeded full-name dimension backfilled correctly, the short `dq` form was
  rejected, and history mutation failed.
- Production applied migration `0027_smart_tempest` and matched the 72-table
  fingerprint
  `79dc9062ac22f342d681aa0c05670ca49ba2b60f9d7ce99d8ea69940f0baf4bb`.
- The generated dictionary covers 72 tables and 990 columns. The checked Atlas
  review packet and post-migration zero-write preflight reproduce.
- Index/Pulse presentation change control advanced append-only to
  `civica-index-pulse-dimensional-output-history-v19`.

## Public contract and build

- The Pulse runtime contract is `pulse-v2.12-beta`, hash
  `dccb865c4dd8c6f923c2db5b5d9c45b5599b391f0adde36bcaba5948efe33992`.
- The claims-and-documentation gate passed all seven categories and all 907
  tests. TypeScript and the full production build passed.
- The Pulse methodology rendered in light and dark modes with no horizontal
  overflow, console error, or page error. Its version section states the
  immutable history, atomic projection, zero-tombstone, and public-null rules.
- Next.js emitted the existing broad file-tracing warning from
  `next.config.ts`; compilation, type checking, and all 105 static page builds
  completed successfully.
