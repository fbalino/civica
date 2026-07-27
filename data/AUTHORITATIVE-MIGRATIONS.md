# Authoritative database migrations

`drizzle/authoritative/` is the only deployable schema history. The older
`drizzle/migrations/` directory remains a declared historical archive; it is
not replayed on deploy.

## Baseline

`0000_authoritative_baseline.sql` creates the complete current public schema:
50 tables plus every checked column, default, constraint, foreign key, index,
function, view, and trigger. It is paired with Drizzle's structural snapshot
and journal, a hash-pinned runtime manifest, and the checked catalog-level
fingerprint in `data/authoritative-schema-fingerprint.v1.json`.

## Runtime behavior

`npm run db:migrate` fails closed.

- Empty database: execute the baseline transactionally, record it as `executed`,
  then verify the complete public-schema fingerprint.
- Existing database without the authoritative ledger: adopt only when its full
  catalog fingerprint exactly matches, recording `adopted` without replaying DDL.
- Existing ledger: reject unknown IDs or changed hashes, execute each later
  ordered migration once, and verify the resulting fingerprint.

The ledger lives in `civica_meta.schema_migrations`, outside the public schema
fingerprint. Migration is not a Vercel build concern: use the explicit
owner-operated pre-deploy step in [`DEPLOYMENT-REHEARSAL.md`](./DEPLOYMENT-REHEARSAL.md)
against the named staging or production target, then deploy a validation-only
build.

## Adding a migration

1. Change `src/lib/db/schema.ts` and any checked functions, views, or triggers.
2. Run `npm run db:generate`; review the SQL in `drizzle/authoritative/`.
3. Add the ordered file and SHA-256 to `AUTHORITATIVE_MIGRATIONS`.
4. Update the checked fingerprint from a reviewed production-shaped database.
5. Run fresh-database and production-shaped upgrade tests, then
   `npm run validate:authoritative-migrations:live`.

The fingerprint artifact records the authoritative manifest head and a stable
content hash of the complete ordered manifest. Static validation deliberately
rejects legacy artifacts, a stale manifest binding, an altered serialized
schema, or an unexpected artifact version. After any manifest change,
`npm run validate:authoritative-migrations` must fail until the fingerprint is
regenerated from the reviewed database.

Never edit an applied migration, replay the historical archive, or use
`drizzle-kit push` against production.
