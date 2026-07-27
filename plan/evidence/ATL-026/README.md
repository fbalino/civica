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

The disposable QA-018 attempt-07 branch has now applied the complete
authoritative tail through `0051_eminent_jocasta` and retained release
`conditions-20260727-v1`: 340 calculations, 818 exact component rows, and 101
scores, including 162 aligned, six mixed-year-refused, and 71 missing-component
economic calculations. The immutable replay wrote zero score/component rows,
and the post-refusal live validator remained unchanged. Bounded evidence is in
[`../QA-018/attempt-07-conditions-release-2026-07-27.md`](../QA-018/attempt-07-conditions-release-2026-07-27.md)
and
[`../ATL-027/attempt-07-release-validation.v1.json`](../ATL-027/attempt-07-release-validation.v1.json).

Production remains separately authority-gated. ATL-026 stays unchecked until
the production ledger and selected public release pass the same live
decomposition and public-read gates.
