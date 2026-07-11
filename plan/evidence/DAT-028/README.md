# DAT-028 evidence — statement provenance repair

DAT-028 closes statement identity and subject resolution across storage and all seven producers.

## Result

- Before repair: 7,891 statements, 352 duplicate identity groups with 1,121 excess rows, and 5,394 wrongly typed or orphaned subjects.
- After repair: 6,768 statements, zero unresolved subjects, and zero duplicate identity groups.
- Subject distribution: 20 constitutions, 1,236 elections, 250 government bodies, 249 jurisdictions, and 5,013 terms.
- All 6,768 statements remain source-linked.
- Research history retained 5,365 updated prior rows and 1,123 deleted prior rows during repair.

## Enforcement and repeatability

- Authoritative migration `0001_aspiring_bloodaxe.sql` has SHA-256 `113c545226364b362f78480f3a9a83cee52605e39b37eeb3e27ae651d520e4d0`.
- The database check closes the allowed subject types, a trigger verifies every polymorphic subject, and a unique index covers subject type, subject ID, predicate, and source ID.
- Every statement producer is in a closed seven-file inventory and uses the same source-aware identity for reruns.
- A disposable PostgreSQL 17 database applied the baseline and migration. Orphan and duplicate inserts were both rejected.
- Fresh and live schema fingerprint: `647e8ed0a2d95e59e46ea7a53b5c8ac56acc6b078b1053fa19ac69dbde945e54`; live ledger: 2/2; rerun: zero pending migrations and zero writes.

## Verification

- `npm run validate:statement-provenance`
- `npm run validate:statement-provenance:live`
- `npm run validate:release-quality:report`
- `npm run validate:fact-coverage`
- `npm run db:generate` — no schema changes
- Full test suite: 636/636 passed
- `npm run build` — passed, including claims/docs and migration gates

The sole remaining release-quality anomaly is the numeric North Korea military-expenditure corruption assigned to DAT-029; statement provenance is clean.
