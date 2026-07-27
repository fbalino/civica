# PUL-027 — decay window and event lifecycle correction

**Status:** implementation and forward migration prepared; production application remains pending.

## Problem

The taxonomy declares a 730-day half-life for `foreign_occupation`, while the
score loader, in-memory guard, public runtime contract, and database checks
previously admitted only a 365-day lookback. That silently truncated the second
half of the declared decay curve.

## Decision

1. Set the current scoring window to the maximum declared taxonomy half-life
   (`730` days), derived from the category registry rather than duplicated.
2. Keep existing 365-day score and history rows immutable and interpretable.
   New runs carry the expanded window and a new delta-algorithm version; no
   historic row is overwritten or relabelled.
3. State the event lifecycle explicitly: only the current, published,
   reviewed projection is scoreable; a correction supersedes rather than
   mutates the prior projection; persistence is never inferred; a later
   recurrence requires a separately accepted event with its own date.
4. Replace the fixed-window database checks with a closed `{365, 730}`
   compatibility set and preserve the date-arithmetic invariant.

## Forward-only production sequence

1. Run `npm run db:plan -- --id=0043_pulse_decay_lifecycle --live` and retain
   its zero-write count report under `plan/evidence/PUL-027/`.
2. Confirm an isolated backup/restore point, then apply the reviewed
   authoritative migration through the approved production workflow.
3. Run one fresh, versioned Pulse score computation. It must create 730-day
   current rows and append new output-history rows; it must not update old
   history.
4. Record live invariants: valid window/date arithmetic, no current score
   whose event falls outside its recorded window, and a publication pointer
   whose algorithm is `pulse-delta/decay-window-v2.5+incident-resolution-v1+output-history-v1+absorption-evidence-v1`.
5. Run `npm run validate:pulse-delta-lifecycle:live`,
   `npm run validate:pulse-runtime:live`, and the task-focused tests before
   checking PUL-027 and adding its progress/evidence completion record.

## Local acceptance checks

- Every configured half-life is at most the derived score window.
- Deterministic score fixtures include every declared category at its own
  half-life, the inclusive 730-day boundary, a 731-day exclusion, future
  exclusion, and both delta bounds.
- The runtime-method snapshot states the new window and lifecycle policy.
- The migration permits only historic 365-day and new 730-day rows, with
  `window_start = score_as_of - window_days` in both output relations.
- `npm run typecheck`, the focused Pulse tests, runtime/lifecycle validators,
  migration validators, the generated data-dictionary validator, and the
  master-plan validator pass.

## Completion boundary

PUL-027 stays unchecked until the forward migration and a newly versioned
production recomputation have completed with retained evidence. This plan does
not authorize either production write.

## Local verification recorded 2026-07-18

A disposable PostgreSQL 17.9 catalog applied the complete authoritative chain
through `0043_pulse_decay_lifecycle`; its public-schema fingerprint matched
the newly checked value
`01d0ff69c2b10cfcab623693081a259e27610cc51cbca236d4315ae1e3b118ab`.
The configured-database preflight performed zero writes and found 325 current
projection rows plus 1,625 history rows. See `plan/evidence/PUL-027/`.
