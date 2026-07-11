# DAT-026 — Authoritative migration path

Completed 2026-07-11.

## Outcome

`drizzle/authoritative/` is now the only deployable schema history. Its reviewed
baseline creates the complete current public schema: 50 tables and all checked
columns, defaults, constraints, foreign keys, indexes, functions, views, and
triggers. The incomplete older Drizzle history remains available as a declared
historical archive but is never replayed by deployment.

The runtime manifest pins every ordered migration by SHA-256. `npm run
db:migrate` creates an empty database, adopts an existing database only when
its complete public catalog is an exact match, rejects unknown or changed
migrations, applies each later migration once, and verifies the expected schema
fingerprint after execution. Vercel runs this migrator before building the app.

## Fresh and upgrade proofs

- PostgreSQL 17 fresh database: the baseline executed successfully, created 50
  public tables, and produced fingerprint
  `92914965fc631e39e059fde8c7d9d4daaeb7cb24b8c025f19a28db60af9b6bee`.
- Production-shaped upgrade: the existing 50-table schema matched the same
  fingerprint before adoption, so the runner wrote only the metadata schema,
  ledger table, and one `adopted` ledger row. It replayed no public DDL.
- Second production run: 1 migration applied, 0 pending, 0 writes in plan mode.
- Generator determinism: regenerating the baseline retained file SHA-256
  `3ba983b97fc6eeaad67c38c069ec72edf0371e62c2f7037380d86343dc13a418`
  and the same catalog fingerprint.

The disposable local cluster and database files were deleted after the test.
No production fact or research row changed.

## Verification

- `npm run validate:authoritative-migrations`: pass; 50 tables, 1,171
  statements, one ordered migration, manifest and Drizzle journal aligned.
- `npm run validate:authoritative-migrations:live`: pass; ledger 1/1, baseline
  mode `adopted`, exact catalog fingerprint.
- `npm run db:migrate -- --plan`: pass; 0 pending and 0 writes.
- `npm run db:generate`: pass; no schema changes.
- 633/633 tests pass.
- All build-time migration, data, release, rights, claims, documentation, and
  application gates pass; the production build passes.

Machine-readable result: `fresh-and-upgrade-result.json`.
