# PLT-016 migration plan

`0037_minor_sharon_carter` is an additive empty-table migration for the
privacy-bounded `route_performance_observations` ledger. The checked
`plan/evidence/DAT-013/preflight.json` is regenerated with a zero-write live
row-count plan before the task is marked complete.

The 2026-07-15 preflight recorded `route_performance_observations` as missing,
with 56/56 plans and zero writes. A disposable local PostgreSQL 17.9 catalog
applied the checked SQL only, then produced the added relation's exact catalog
shape (11 columns, 8 constraints, and 4 indexes). Its derived checked
post-migration fingerprint is
`50d12b73c1ad8b20d4907e41a36d1c68669924e4e0d45a56f2a3433cc1b89628`.

The configured database is not migrated by PLT-016. PLT-019 must apply the
schema in staging, repeat the authoritative ledger/fingerprint check, exercise
the deployment order, and determine the forward-fix or restore decision point.
