# ATL-026 — Conditions component ledger

This evidence records the checked implementation and its controlled-rollout
boundary. It does not claim that the configured database has been migrated or
that historic Conditions rows have been rewritten.

## Contract

`conditions-components/v1` retains one calculation ledger and all of its
declared native inputs. The current strict alignment rule is
`all-components-same-reference-year/v1`: an economic calculation with missing
or mixed-year inputs remains a persisted unavailable ledger, not a score
labelled with its newest component year. HDI, peace/security, and economic
inputs all retain source/indicator lineage and their inclusion decision.

## Checked evidence

- `migration-plan.md` records the zero-write live preflight and a fresh local
  PostgreSQL 17.9 authoritative-chain fingerprint check.
- `release-note.md` describes the additive migration and read boundary.
- Conditions golden, repeatability, refusal/missingness, and migration tests
are exercised by `npm run validate:conditions-components`.

The regenerated fingerprint also captures the current checked definition of
the pre-existing `civica_guard_published_pulse_history` function from
migration `0036`; no `0036` migration source was changed for ATL-026. This
repairs a previously stale checked fingerprint while preserving the actual
authoritative migration chain.

## Rollout boundary

The configured Neon database remains at authoritative migration `0032`.
`0040_closed_young_avengers`, Conditions ingestion, and an inspection of
aligned/missing/mixed-year rows must first run in the isolated staging
procedure recorded in `data/DEPLOYMENT-REHEARSAL.md`. A production migration
requires Fernando's release authority. Until then, ATL-026 remains unchecked.
