# PUL-024 — drift-monitoring implementation evidence

## What is implemented

`pulse-drift-monitor/v1` now defines seven aggregate operational distributions:
source mix, language mix, model versions, taxonomy labels, corroboration-weight
buckets, abstention, and human-review overturns. Each completed current-method
score run records one append-only observation after score publication. An
explicit baseline is immutable and is never created or moved by the scheduled
monitor. Distribution shifts and any novel model version write append-only
alerts with bounded internal row identifiers and a metric-specific remediation
link in `data/PULSE-DRIFT-MONITORING.md`.

The monitor is deliberately not an accuracy, recall, fairness, or calibration
claim. A missing baseline and a sparse metric remain explicit states rather
than being treated as zero.

## Local verification — 2026-07-18

- `npm run typecheck` passed.
- `npm run validate:pulse-drift` passed: 5/5 tests, including a deliberately
  shifted source distribution and a novel model version alert.
- `npm run validate:research-evidence-retention` passed after registering the
  existing 90-day, scrubbed error-monitoring retention exemption.
- `npm run validate:migrations`, `npm run validate:authoritative-migrations`,
  and `npm run validate:data-dictionary` passed.
- A disposable PostgreSQL 17.9 database already containing the full
  authoritative chain through `0043` accepted `0044` unchanged. Its generated
  full public-schema fingerprint is
  `e64ecf0298f7460fbe111775f52043306eed0a8c5582d355139f040a652cc8e7`,
  and `scripts/check-postgres-schema-fingerprint.ts` passed against it.
- `npm run db:plan -- --id=0044_pulse_drift_monitoring --live` was a
  configured-database zero-write plan: 14 statements, zero destructive
  statements, and the three new relations are currently absent.

## Completion boundary

This task remains open. The configured database has not received `0044`; no
`pulse-v2.15-beta` baseline exists; and the prospective window has not started.
After the owner/platform deploys the frozen method and PUL-040 records an
eligible start, capture the read-only candidate with
`npm run capture:pulse-drift-baseline`. Only an approved explicit `--write`
may create the baseline. The next completed frozen-method score run must then
produce an observation (and, if warranted, an alert) before PUL-024 can be
checked.
