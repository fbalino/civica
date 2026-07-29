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

## Production completion — 2026-07-29

Production release `conditions-production-20260729-v1` passed its guarded live
validation and exact replay at authoritative migration head
`0051_eminent_jocasta`: 340 calculations, 818 component rows, 101 scores,
three source records, and zero retained-ledger mutation-history rows. The
economic ledger preserves 162 aligned calculations, six mixed-year refusals,
and 71 missing-component calculations; it has no economic composite score.
All three release sources had `last_sync_at` exactly equal to the release
creation time, under the immediate-post-release freshness policy.

The public API selected the exact immutable release and manifest, returned
observed component values with years and unavailable components with null plus
a reason, and confirmed no economic composite. Production browser evidence
covers the explorer plus aligned Afghanistan, mixed-year-refused Bosnia and
Herzegovina, missing-component Andorra, and their comparison; each showed the
corresponding state without rendering a missing value as zero or an economic
composite.

Evidence: [`../ATL-027/production-release-validation-2026-07-29.v1.json`](../ATL-027/production-release-validation-2026-07-29.v1.json),
[`production-public-api-2026-07-29.v1.json`](production-public-api-2026-07-29.v1.json),
and [`production-browser-evidence-2026-07-29.v1.json`](production-browser-evidence-2026-07-29.v1.json).
