# PUL-037 verification

Verified on 2026-07-12.

## Contract and scoring

- Pure fixtures cover eligible fixed-scale absorption, same-period and
  changed-scale rejection, model-candidate rejection, direction mismatch,
  stable decision identity, input validation, and the current no-comparable-
  release state.
- The scorer fixture proves that an absorbed event contributes zero while its
  stored corroboration weight remains unchanged.
- Static validation rejects any event-update or corroboration-confidence write
  in the absorption path and any absorption-table dependency in corroboration.
- Runtime `pulse-v2.14-beta`, hash
  `1da4b090c4df21e2639f02b5dd124e744bd41f02c886289320b95708941c51f0`,
  publishes the separate absorption multiplier and current inactive standing.

## Database and reproducibility

- Production is at 29/29 authoritative migrations and the 73-table fingerprint
  matches the clean PostgreSQL 17 replay.
- The data dictionary covers 73 tables and 1,015 columns.
- Live validation finds zero absorption decisions, zero absorbed events, zero
  unsupported rows, and one append-only trigger.
- DAT-016 live retention passes with seven direct append-only evidence ledgers.
- The current score run considered 13 events, wrote 325 current rows, and
  retained 1,300 immutable outputs across four runs.

## Public contract and gates

- Methodology prose states the exact fixed-scale, explicit-link, actor,
  direction, threshold, as-of, and current no-eligible-pair rules.
- TypeScript, migration, runtime, data-dictionary, claims, complete unit suite,
  production build, and light/dark browser checks pass.
- Index/Pulse change control advances append-only to
  `civica-index-pulse-absorption-evidence-v21`.
