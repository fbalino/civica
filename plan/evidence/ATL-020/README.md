# ATL-020 change-history evidence

This directory records the implementation and verification evidence for the
public Atlas entity change-history contract. It does not claim that migration
`0046` has been applied to the connected production database.

## Contract and API fixtures

The bounded public projection, stable citation binding, public-only correction
join, explicit no-history state, pagination, and invalid-state rejection are
covered by:

- `src/lib/atlas/change-history.test.ts`
- `src/lib/atlas/change-history-writer.test.ts`
- `src/components/atlas/AtlasChangeHistoryDisclosure.test.ts`

The route at
`/api/citations/[entityType]/[id]/history` resolves the canonical stable
citation first, applies the registered bounded query contract, enforces the
public dynamic-read rate limit, and returns the strict
`civica-atlas-change-history/v1` document.

## Browser journeys

`e2e/atl-020-change-history.spec.ts` mounts the production reader module from a
real country fact panel and intercepts only the history endpoint with bounded
fixtures. The journeys cover:

1. a routine publisher refresh with old/new value and vintage;
2. a correction whose private detail remains withheld;
3. a public correction status;
4. loading an earlier page;
5. an existing fact with no recorded public history; and
6. a temporarily unavailable history service while the current observation
   remains visible.

Run against an existing local server:

```sh
E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- e2e/atl-020-change-history.spec.ts --project=chromium --workers=1
```

The checked evidence must record the exact command result after execution.

Verified 2026-07-23 against the local Next.js server on port 3001:

```text
3 passed (10.0s)
```

## Writer and contract verification

The same verification pass produced:

```text
npm run validate:atlas-change-history-writers
PASS — 30 mutation sites; 6 atomic writer boundaries; 11 named historical exceptions

npm run typecheck
PASS

ATL-020 focused contract/SQL/PostgreSQL suite
44 passed

validate-production-adapters
PASS — 108 implementation files closed

validate-sync-freshness
PASS — 0 offending writes

validate-route-io-policy
PASS — 107 routes / 170 route-method contracts

ATL-020-adjacent aggregate contract repairs
21 passed

npm run validate:claims-docs
All claims/documentation checks passed; the transitive unit suite reported
2000 passed, 3 skipped, and 2 failures outside ATL-020 ownership
```

The two remaining unit failures belong to concurrent, uncommitted reader and
Index work and were not absorbed into ATL-020:

- `current Index change-control baseline is complete` reports the existing
  ATL-014 documentation/protected-file drift; and
- `no other shared editorial scope colors bare anchors` reports the existing
  `.editorial-data-table a` selector.

Principal implementation commits:

- `794de413` — recurring reconciliation fact writers;
- `c7e745f2` — constitution-passage projection/history;
- `de257b24` — institution, office, and person writers; and
- `6eb1d799` — election, turnout, and estimate writers.

## Migration boundary — applied and verified

Migration `0046_atlas_entity_change_history.sql` is additive (four statements,
no destructive statement, SHA-256
`78c86331e815fbd799fdcfc51e6d2f569bf66f06ac97c771edde226365eb75cb`). It is now
applied in production as part of the authoritative bulk apply through
`0051_eminent_jocasta` on 2026-07-29. The 2026-08-09 zero-write plan and the
production ledger confirm this without re-applying:

- `production-post-apply-plan-2026-08-09.json` — live `db:plan --id=0046 --live`:
  `atlas_entity_change_history` present, `correction_log` at 2 rows,
  `writesPerformed: 0`.
- `production-migration-state-2026-08-09.v1.json` — the ledger rows for 0046 and
  0047 (both `executed`, matching the repository hashes) and the full
  `db:migrate --plan` result `applied=51, pending=0, publicTables=103,
  writesPerformed=0`.

## Live correction journey (2026-08-09)

The authorized wave completed a real end-to-end journey rather than a synthetic
one, using the genuine Jersey `official_languages`/`languages` markup defect
(literal `<p>…</p>` imported verbatim from upstream `factbook.json`; the
archived CIA page rendered clean text).

1. A public report through the production `/report-data-issue` form produced the
   durable receipt `CA-587FA00E6DEE` (correction_log
   `1953f3e9-2014-4707-b67a-0ed9ecad4ef0`).
2. Authenticated admin triage advanced it `in_review` → `resolved_corrected`.
3. `scripts/repair-jersey-language-markup.ts` (dry-run default) wrote the fix
   through the atomic ATL-020 writer as `change_kind = correction`, release
   `atlas-corrections-20260809-v1`, linked to the report — two history events
   (`71396231-…` official_languages, `8b0c77ee-…` languages).
4. `production-history-api-2026-08-09.v1.json` is the live
   `/api/citations/fact/82a72936-…/history` document: `recorded_history`,
   `operation: update`, `change_kind: correction`, public correction status
   `resolved_corrected`, with the exact `fact_value` before/after diff.
5. `browser/atl-020-jersey-release-history.png` and
   `browser/atl-020-jersey-field-diff.png` show the reader disclosure rendering
   the Field / Previous / Current diff, reason, release, method, and public
   correction status on the real Jersey country page.

## Writer before-snapshot fix (found by this live gate)

The first recording of both events came back as `operation: insert` with all
`before: null`, although the rows pre-existed and were updated. Root cause: the
`before_row` CTE in `country-fact-history-writer.ts` used `FOR UPDATE`, whose
locking scan follows the tuple update chain and skips the row the same
statement's `ON CONFLICT DO UPDATE` already modified, so the before snapshot
came back empty. The prior tests were SQL-shape assertions only and never
executed the update path.

- Fix: drop `FOR UPDATE OF cf` from `before_row`; write serialization is still
  owned by the advisory lock. Reproduced and proven on local PostgreSQL 17 and
  in `country-fact-history-writer.postgres.test.ts` (the update and no-op-rerun
  cases fail with the clause present, pass without it).
- The two already-written production events were repaired from the synchronous
  `research_evidence_history` retention rows (which captured the true
  before/after) by `scripts/repair-atl020-event-before-snapshots.ts`
  (dry-run default, identity- and state-guarded, no inference). Both now read
  `operation: update` with the real `fact_value` before value.

### Sibling writers were checked, not assumed

The defect is specific to the country-fact writer's shape — it inserts a fresh
`proposedId` and conflicts on the natural key `(jurisdiction_id, fact_key,
source_id)`, so the `FOR UPDATE` locking scan and the `ON CONFLICT DO UPDATE`
of the same physical row race and empty the snapshot. The other ATL-020
writers were verified on local PostgreSQL 17 rather than assumed:

- institution, office, and person (`government-entity-history-writer.ts`) each
  insert `COALESCE(before_row.id, proposedId)` and conflict on the primary key
  `id` — the same-key shape. A real-PG replay of an existing-row rename in each
  recorded `operation: update` with the true previous value. They are correct;
  they were left unchanged. (PGlite mis-reported the office case, which is why
  the check was run on real PostgreSQL.)
- constitution-passage uses the same same-key (`passage_id`) conflict shape and
  a set-based supersession, not the country-fact new-id/natural-key shape.
- elections and the country-fact demotion statement capture the before snapshot
  with a separate `UPDATE … WHERE id IN (before_row)` / `INSERT … WHERE NOT
  EXISTS (before_row)`, so their `FOR UPDATE` is a correct row lock and is
  retained.
