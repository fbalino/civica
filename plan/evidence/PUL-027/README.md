# PUL-027 — decay window and lifecycle correction

**Status:** prepared, not complete. Production migration and the required
fresh score recomputation have not been authorized or run.

## Local verification — 2026-07-18

- The score window is derived from the maximum category half-life: 730 days.
- The score fixture covers every configured category at its own half-life, the
  inclusive 730-day boundary, a 731-day exclusion, future-date exclusion, and
  both `[-15, +10]` bounds.
- The pure lifecycle contract admits only current, published, approved/edited
  projections; it explicitly retains superseded projections, forbids inferred
  persistence, and requires a separate accepted event for recurrence.
- A fresh disposable PostgreSQL 17.9 catalog applied the authoritative SQL
  chain through `0043_pulse_decay_lifecycle`. Its full public-schema
  fingerprint matched the checked artifact:
  `01d0ff69c2b10cfcab623693081a259e27610cc51cbca236d4315ae1e3b118ab`.

## Configured-database preflight — 2026-07-18T13:33:53Z

`npm run db:plan -- --id=0043_pulse_decay_lifecycle --live` performed zero
writes. It found 325 current projection rows and 1,625 append-only history
rows. The four-statement migration affects only those two relations, drops no
relation or data, and replaces the fixed window check with the closed
`{365, 730}` set plus unchanged date arithmetic.

## Remaining release evidence

1. Confirm isolated backup/restore readiness and apply the forward migration
   through the approved production workflow.
2. Run a fresh score computation under the v2.5 decay algorithm. It must write
   730-day current rows and append new history without rewriting 365-day rows.
3. Record live lifecycle/runtime validation and the post-score publication
   pointer before checking PUL-027 in the master checklist.
