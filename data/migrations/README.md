# Migration operating contract

`src/lib/db/migration-registry.ts` is the current inventory authority for
schema and production-data changes. It does not pretend the old Drizzle journal
is complete: 12 artifacts are journaled, two collide on legacy sequence
numbers, and later forward SQL plus operational data changes are explicitly
recorded outside that journal. DAT-026 owns the authoritative baseline and
ordered replacement history.

## Required workflow

1. Create a checked forward SQL/Drizzle artifact or a bounded data-change
   script. Register it before use.
2. Add its rollback or forward-compensation plan, dry-run plan, invariant plan,
   and release-note linkage to the registry.
3. Run `npm run db:plan -- --id=<id> --live`. This reads relation existence and
   exact pre-change row counts; it performs zero writes.
4. Confirm an isolated backup/restore point. Apply only the reviewed forward
   artifact through the approved production console/workflow while DAT-026's
   migrator remains pending.
5. Run the task-specific postflight invariants and `npm run
   validate:migrations`. Record observed before/after counts under the task's
   `plan/evidence/<TASK>/` directory.
6. Link the change in `data/migrations/CHANGELOG.md` and the owning task's
   progress/evidence record.

## `db:push`

`npm run db:push` always refuses. Drizzle push is not production history. A
disposable non-production database may use
`CIVICA_ALLOW_DB_PUSH=local-only npm run db:push:local`; the wrapper refuses in
production or Vercel environments. No pushed schema is evidence that a
migration was reviewed or applied.

## Rollback posture

Production rollback is restore-or-forward-compensate, never an implicit reverse
DDL guess. A destructive migration requires an isolated backup and a named
compensating artifact before apply. Historical artifacts whose original
rollback evidence is unavailable are labeled legacy; that missing history is
not reconstructed.
