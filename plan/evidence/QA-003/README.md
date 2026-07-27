# QA-003 — deterministic fixture database

## Outcome

`civica-qa-database-fixture/v1` provides a credential-free, deterministic
database fixture for tests. `data/fixtures/qa-database/fixture.v1.json` holds
only invented CC0 test records and is loaded into a fresh, in-memory PGlite
instance. It never reads environment variables, accepts no production
connection string, performs no network request, and is closed after each test.

The fixture covers the required representative country/entity states:

- sovereign, dependency/territory, and disputed/limited-recognition
  jurisdictions;
- fresh and stale multiple-source provenance;
- observed, missing, disputed, and not-observed facts with a linked dispute;
- constitution, completed and scheduled elections, organizations, and
  memberships;
- K1 and K3 Index candidates; and
- a retained non-governance Pulse negative plus pending event and cluster.

`data/fixtures/qa-database/expected.v1.json` pins the input SHA-256 and exact
relational row counts. The fixture test additionally applies the real,
self-contained authoritative migration
`drizzle/authoritative/0034_superb_the_fallen.sql` and checks its cron
relations. This proves isolated migration exercise without a production
credential; QA-017 still owns full clean-checkout migration-history proof.

## Implementation and verification

- Contract and loader: `src/lib/qa/fixture-database.ts`
- Fixture and checked expectation: `data/fixtures/qa-database/`
- Generator and validator: `scripts/generate-fixture-database.ts` and
  `scripts/validate-fixture-database.ts`
- Operating/safety details: `data/TEST-FIXTURE-DATABASE.md`

The PGlite design was checked against its official documentation on 2026-07-18:
in-memory `PGlite.create("memory://")`, parameterized queries, multi-statement
`exec()` migrations, and `close()` semantics. The project already carries
PGlite as a development dependency.

Run on 2026-07-18:

```sh
npm run generate:fixture-database
npm run validate:fixture-database
npm run validate:verification-matrix
npm test
npm run typecheck
node plan/tools/validate-master-plan.mjs
git diff --check
```

The focused fixture, matrix, TypeScript, plan-integrity, and diff gates pass.
The workspace-wide `npm test` currently has seven unrelated
failures caused by concurrent user-owned route, Index-change-control, schema,
and source-manifest work (the affected tests discover 105 routes / 93 tables /
50 pipelines while their checked registries still declare 100 / 90 / 47). The
QA-003 fixture tests themselves pass. No production database, source system,
paid model, or browser mutation is involved.
