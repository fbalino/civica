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

## Migration boundary

Migration `0046_atlas_entity_change_history.sql` is additive, but applying it
requires the normal live zero-write plan, production authority, migration
execution, and live verification. Until then:

- implementation and fixture evidence may be complete;
- the reader honestly renders its unavailable state against a database without
  the relation; and
- ATL-020 remains open rather than manufacturing live-release evidence.

The required zero-write live plan ran on 2026-07-23:

```text
id: 0046_little_mulholland_black
historyStatus: journaled
sha256: 78c86331e815fbd799fdcfc51e6d2f569bf66f06ac97c771edde226365eb75cb
statementCount: 4
destructiveStatementCount: 0
atlas_entity_change_history: missing
correction_log rows: 1
writesPerformed: 0
```

This confirms that the next ATL-020 action is an authorized production
migration followed by the live validator, not additional implementation work.
