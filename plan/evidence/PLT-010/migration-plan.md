# PLT-010 migration plan

`0034_superb_the_fallen` adds the durable cron execution, attempt, and lease
relations plus database-time acquire/finalize functions, append-only guards,
terminal-evidence constraints, lease fencing, and the explicit unqueued
`busy` outcome. Its reviewed SHA-256 is
`51ac043cd187d0f00e3b60d6cfa56b08231de8911a5a65f0d353a8df01563a86`.

`0035_equal_marvex` adds the immutable Pulse classification delivery-to-run
binding. Its reviewed SHA-256 is
`e10d60be954a5be888934db76218a36dd177981909d689610665fbd4ac645913`.

`npm run db:plan -- --all --live --out=plan/evidence/DAT-013/preflight.json`
recorded 54 current plans and zero writes. The production-shaped database used
for the read-only plan had neither new migration applied, so all four new
relations were correctly reported missing before deployment.

The complete authoritative chain, migrations `0000` through `0035`, replayed
on a disposable PostgreSQL 17 database. It produced 86 public tables and three
views. The checked catalog fingerprint is
`f38227eb1e6e6a3d86951d8a7aa61ce875d6469efd52a4afead9dbbf8896f29c`.
The field dictionary covers 86 Drizzle tables and 1,213 columns.

No production migration was applied. Deployment continues to run the
authoritative migrator before the application build. Recovery uses an isolated
pre-change backup or a reviewed forward compensation; operators must never
delete delivery evidence, reset a fence, or repoint a classification binding
as an ordinary rollback.
