# PLT-017 migration plan

`0038_heavy_slyde` adds the empty `production_pipeline_runs` operational
ledger: 18 columns, six constraints, and five indexes (including its primary
key). The migration is additive and intentionally unapplied by PLT-017;
PLT-019 owns staging/production deployment ordering and rollback rehearsal.

The checked post-migration schema fingerprint is
`6c721e92228fc256add2aa65245ce9a2e46551744bf54761c4820ee8cbd0d562`.
In the local sandbox, PGlite applied the additive SQL and produced the exact
catalog representation used for the new relation. That same catalog method was
cross-checked against PLT-016's already checked `route_performance_observations`
relation before the new table slice was merged into the fingerprint.

Before the task can be checked off, regenerate the configured-database
zero-write plan with:

```sh
npm run db:plan -- --all --live --out=plan/evidence/DAT-013/preflight.json
```

The command must report `production_pipeline_runs` as `missing` and zero
writes. No configured database was migrated while preparing this evidence.
