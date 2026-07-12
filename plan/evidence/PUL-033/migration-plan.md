# PUL-033 migration and recovery plan

## Forward change

- Artifact: `drizzle/authoritative/0025_careful_the_professor.sql`
- Adds one retained obligation projection and one append-only SLA event ledger.
- Adds restrictive foreign keys, closed state and time-shape checks, unique
  event/version identity, an automatic queue-entry trigger, a review-status
  check, synchronous mutation retention, and an append-only event guard.
- Backfills only the directly observed pre-contract pending queue. Event
  creation time is labelled `created_at_proxy`; no historical queue clock,
  review decision, exception, or compliance result is invented.
- Retains the old queue as `legacy_quarantined`, unpublished and not
  human-reviewed. New queue entries use a recorded clock and active obligation.

## Preflight and verification

- The targeted live plan reports relation presence and row counts with zero
  writes and zero destructive statements.
- The complete 26-migration path must pass on a fresh PostgreSQL 17 database.
- Production must match the checked 73-table schema fingerprint after apply.
- Live validation must prove one active obligation per pending current event,
  no duplicate active incident, no false legacy review state, no invalid active
  exception, and a persisted escalation for every item whose threshold passed.

## Recovery

Do not delete SLA events or rewrite legacy quarantine as human review. A full
rollback uses an isolated pre-change backup. A policy or trigger defect is
repaired by a reviewed forward migration that retains migration 0025 and its
event records. The monitor can be disabled without altering evidence while a
forward repair is prepared. Restoring a legacy item to active review requires
an explicit new-version workflow rather than changing its historical state.
