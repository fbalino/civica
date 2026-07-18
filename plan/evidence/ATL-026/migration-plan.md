# ATL-026 migration plan

`0040_closed_young_avengers` adds the decomposable Conditions ledger:
`civica_conditions_calculations`, `civica_conditions_components`, and the
nullable calculation foreign key on `civica_conditions_scores`. The migration
is additive. It attaches the calculation and component tables to the existing
research-evidence retention trigger and does not delete or rewrite historic
scores.

## Preflight — 2026-07-18

`npm run db:plan -- --all --live --out=plan/evidence/DAT-013/preflight.json`
performed zero configured-database writes. Its ATL-026 relation counts were:

- `civica_conditions_calculations`: missing (expected before migration)
- `civica_conditions_components`: missing (expected before migration)
- `civica_conditions_scores`: 331
- `research_evidence_history`: 79,465

The migration content SHA-256 is
`467fbe0f8e9d7b4e4149fcaf60e730db9e5a2d54f65d6782294ad2bf5cab51a9`.

## Catalog verification

A fresh disposable local PostgreSQL 17.9 catalog applied the checked
authoritative sequence from `0000_authoritative_baseline` through `0040`.
`scripts/check-postgres-schema-fingerprint.ts` then matched the regenerated
target fingerprint exactly:

`dd71ee71e10933f7ad4b4699a14e10458d8def41cf9d94399677804ef0fa64da`

No Neon schema, source data, or Conditions rows were changed. The staging
rehearsal must run the same zero-write plan, apply the migration, validate the
authoritative live fingerprint, and inspect the new aligned/refused/missing
ledger rows before an authorized production rollout.
