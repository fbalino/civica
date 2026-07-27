# Live-database test policy (QA-004)

Civica's default test suite (`npm test`) is DB-free: every test uses in-memory
fixtures or pure functions. A small number of contract tests may read the live
database, but **no test may modify production**. This document is the policy;
it is enforced by code, not convention.

## The one sanctioned live-DB path

`src/lib/db/live-readonly.ts`:

- **`getLiveReadOnlyDb()`** is the only client a test may use against
  `DATABASE_URL`. It:
  - throws unless `RUN_DB_TESTS === "1"` (so live-DB tests never run in the
    default suite or a normal build), and
  - returns a client whose mutation methods (`insert`, `update`, `delete`,
    `execute`) throw — reads only.
- **`reportLiveTestEnvironment()`** prints the target with the username,
  password, and unique endpoint id redacted (e.g. `***.neon.tech db=<name>`),
  so test output identifies the environment without leaking a credential.

## Two-layer enforcement

1. **Runtime** — the read-only proxy above refuses mutation, and refuses to
   construct outside `RUN_DB_TESTS=1`.
2. **Static** — `src/lib/qa/live-db-test-isolation.test.ts` (runs in the default
   suite) scans every `*.test.ts` and fails if any test imports the production
   Drizzle client (`db`/`getDb`/`createDb` from `@/lib/db`, `@/lib/ci/ingest`,
   or `@/lib/pulse/v2/ingest`) and issues a write on it. A disposable fixture
   cluster (its own `node-postgres` client) is not the production db and is
   allowed.

## Commands

- `npm test` — the default, DB-free suite. Includes the guard + isolation tests.
- `npm run test:db` — sets `RUN_DB_TESTS=1` and runs the same globs; the live
  contract test (`worked-examples.test.ts`) then executes **read-only** queries
  against `DATABASE_URL` via `getLiveReadOnlyDb()`.

## Fixture-database coverage and limits

- The only live-DB contract test today is
  `src/lib/factbook/reconcile/__tests__/worked-examples.test.ts` — it resolves
  the eight reconciliation worked examples and asserts canonical values within
  tolerance. It reads via the read-only client.
- `civica-qa-database-fixture/v1` now creates a fresh in-memory PGlite
  PostgreSQL instance from synthetic, CC0 test rows. It covers jurisdiction
  statuses, full/partial/missing/disputed/stale states, multiple sources,
  constitutions, elections, organizations, Index candidates, Pulse
  negatives/clusters, and a representative authoritative migration without a
  `DATABASE_URL`. See `data/TEST-FIXTURE-DATABASE.md` and run
  `npm run validate:fixture-database`.
- It is a reusable fixture foundation, not a substitute for the deliberately
  separate production read-only worked-example test. `test:db` continues to
  target the configured read-only environment only when explicitly requested.
- `test:db` targets whatever `DATABASE_URL` points at. Point it at a read
  replica or a disposable copy when one exists; the read-only guard makes a
  production target safe for reads regardless.
