# PLT-015 — query and index budget audit

## Scope

The budget contract covers six representative reader/API profiles over the
largest currently observed country fact, indicator-history, and Pulse event
sets; the complete constitution passage corpus; the pointer-selected Index
release; and the pointer-selected Pulse publication panel. It deliberately
measures database execution separately from Neon round trip time.

## Bounded read decisions

- Country facts are jurisdiction-keyed and capped at 250 rows.
- Constitution search is GIN-backed and returns 20 results plus one cursor
  sentinel, never passage text.
- Indicator history is jurisdiction-keyed and capped at 500 rows.
- Index rankings read one pointer-selected release, order by stored rank, and
  use the public 250-row ceiling.
- Pulse validates one pointer-selected fixed five-dimension panel rather than
  scanning history across runs; country event reads cap at 251 rows.

Every profile names source files, an exact high-cardinality fixture, a p95
database-execution budget, a maximum result size, and its required
migration-managed schema indexes in `src/lib/platform/query-budget.ts`.

The runner detects whether the additive PLT-014 Index and Pulse publication
pointer relations are present. Before the PLT-019 deployment rehearsal applies
migration `0036`, it records the live pre-deployment Index query through its
current quarter/method selector and the Pulse panel through its newest immutable
run. Once the relations exist, both profiles switch to pointer-selected reader
queries. The report names each boundary and never mislabels a fallback as a
published pointer selection.

## Running the live audit

`npm run benchmark:query-budgets` reads the configured database using only
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` over fixed SELECT queries. It records
both execution and round-trip p95 values, plan nodes, indexes observed by the
planner, shared-buffer hits, and row ceilings. `--write` updates only the
checked evidence JSON; it does not write to the database.

The static `npm run validate:query-budgets` gate runs without credentials and
rejects missing source paths, undeclared schema indexes, missing domains, or an
unbounded profile.
