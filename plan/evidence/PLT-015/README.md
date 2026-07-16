# PLT-015 — database query and index budgets

The checked `civica-query-budget/v1` contract covers high-cardinality country
facts, the full constitution corpus, country indicator history, Index release
rankings, Pulse publication panels, and country Pulse events. Each profile has
a source file, fixed fixture, migration-managed indexes, result bound, and
database p95 budget.

## Evidence index

- `source-review.md` — official PostgreSQL plan-analysis guidance consulted on
  2026-07-15
- `live-query-budget.json` — read-only configured-database execution plans and
  p95 measurements

The static gate does not fabricate latency: its job is to ensure the contract,
index declarations, source paths, domain coverage, and bounds remain closed.
The live report also names whether it measured the pre-`0036` Index and Pulse
schemas or the pointer-selected post-migration readers; production migration
application is owned by PLT-019.

## Recorded live outcome

The 2026-07-15 read-only run passed all six profiles. Database execution p95
ranged from 1.214 ms to 5.952 ms against 50–100 ms budgets; the largest
observed bounded result was the 333-row Afghanistan indicator history against
its 500-row ceiling. The country facts, constitution corpus, indicator history,
and current country Pulse-event profiles used their registered indexes. The
configured database is pre-`0036`, so the Index and Pulse publication profiles
record their explicit pre-migration selectors; their small current tables chose
sequential scans, which the source review says is not evidence of a missing
index by itself. PLT-019 owns applying the additive pointer schema and repeating
the pointer-selected production rehearsal.

The static budget contract, query-plan fixture suite, CI workflow contract,
TypeScript, and full production build passed before this task was closed.
