# Credential-free test fixture database

**Contract:** `civica-qa-database-fixture/v1`

This is the disposable database fixture for QA-003. It is deliberately
separate from production, a Neon branch, the G2 clean-room export fixture, and
the default read-only live-database checks.

## Safety and rights

`data/fixtures/qa-database/fixture.v1.json` contains only invented records
authored for test coverage. Every source is labelled `fixture_*`; every entity,
country name, identifier, event, organization, value, and source timestamp is
synthetic; and the fixture declares CC0-1.0. It contains no publisher payload,
production identifier, personal data, customer data, protected source text, or
credential.

The fixture is loaded into a fresh in-memory PGlite instance. No environment
variable is consulted, no `DATABASE_URL` is accepted, and no database state is
persisted after the test closes the instance. PGlite's official documentation
was verified on 2026-07-18: `PGlite.create("memory://")` provides ephemeral
in-memory Postgres; `.query()` supports parameterized queries; `.exec()`
supports multi-statement migrations; and `.close()` shuts the instance down.

## Coverage

The fixture includes three jurisdiction-status cases (sovereign,
dependency/territory, and disputed/limited recognition); fresh and stale
sources; observed/full, partial/missing, disputed, and not-observed values;
multiple sources; a constitution; completed and scheduled elections;
organizations and memberships; K1 and K3 Index candidates; a retained
non-governance Pulse negative; and a pending Pulse event/cluster.

The test also applies the real, self-contained authoritative migration
`0034_superb_the_fallen` after the fixture baseline and verifies its three cron
relations. That proves a disposable Postgres fixture can exercise a production
migration without a production credential. It does not claim to replay the
entire authoritative production history; QA-017 owns the clean-checkout/full
migration proof.

## Commands

```sh
npm run generate:fixture-database
npm run validate:fixture-database
```

The checked expected artifact pins the exact fixture-byte SHA-256, relational
row counts, migration source, and required relations. Regenerate only when a
reviewed fixture-contract change intentionally changes those values.
