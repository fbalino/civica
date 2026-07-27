# QA-004 — live-database tests are read-only and separable

Completed 2026-07-12. The default suite is DB-free; the one sanctioned live-DB
path is read-only, and a static scanner proves no test can modify production.

## What shipped
- `src/lib/db/live-readonly.ts` — `getLiveReadOnlyDb()` throws unless
  `RUN_DB_TESTS=1` and returns a client whose mutation methods (`insert`,
  `update`, `delete`, `execute`) throw. `reportLiveTestEnvironment()` prints the
  target with username, password, AND unique endpoint id redacted
  (e.g. `***.neon.tech db=neondb`).
- `src/lib/db/__tests__/live-readonly-guard.test.ts` — DB-free: refusal outside
  the harness, refusal without `DATABASE_URL`, every mutation method blocked,
  reads allowed, and credential/endpoint redaction.
- `src/lib/qa/live-db-test-isolation.test.ts` — DB-free static scanner: fails if
  any `*.test.ts` imports the production Drizzle client and issues a write on
  it. Proven by seeded fixtures (a production write is flagged; a read, a
  disposable fixture-cluster write, and a `getLiveReadOnlyDb()` read are not).
- `src/lib/factbook/reconcile/__tests__/worked-examples.test.ts` — the only
  live-DB test — now reads via `getLiveReadOnlyDb()` and reports the target with
  `reportLiveTestEnvironment()`.
- `src/lib/db/index.ts` — exports the shared `CivicaDb` type.
- `data/LIVE-DB-TEST-POLICY.md` — the policy.

## Done-when → evidence
- **refuses unsafe/mutable connection modes** — the read-only client refuses to
  construct outside `RUN_DB_TESTS=1` and refuses every mutation method (guard
  tests + runtime proxy).
- **executes documented read-only queries/invariants** — `test:db` resolves the
  eight reconciliation worked examples via the read-only client (live run
  header: `Resolving 8 worked examples against live target: ***.neon.tech
  db=neondb (read-only; credentials + endpoint redacted)`).
- **reports the target environment/vintage safely** — `reportLiveTestEnvironment()`
  redacts credentials and the endpoint id; asserted by the guard test.
- **no test can modify production** — runtime refusal + the static scanner; the
  real-repo scan is empty (only `worked-examples.test.ts` touched the live db,
  and it now uses the read-only client).

## Verification
- `node --import tsx --test` on the two new files → 7/7 pass.
- Full DB-free suite `npm test` → **1095/1095** pass.
- `npx tsc --noEmit` clean.
- `npm run test:db` executed the live read-only queries successfully with the
  redacted-target header.

## Finding (separate from QA-004, pre-existing)
`npm run test:db` currently shows **2 worked-example failures** — Brazil GDP
growth and South Africa unemployment. These are live-data drift: scheduled
factbook syncs updated those vintages since DAT-007 (when all eight passed), so
the frozen worked-example expectations are now stale. This is NOT a QA-004
regression (the read-only swap does not change query results — reads are
byte-identical). It is a reconciliation/worked-example-refresh concern tracked
as a follow-up.
