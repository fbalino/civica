# PLT-015 source review — 2026-07-15

## PostgreSQL documentation

- [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
  — consulted 2026-07-15. The official guide confirms that `EXPLAIN ANALYZE`
  executes a query, recommends JSON for programmatic processing, distinguishes
  planning from execution time, and documents `BUFFERS` for I/O observations.
  It also cautions against extrapolating small-table plans to production-sized
  data and against treating network time as database execution.

## Applied decision

The PLT-015 runner permits only fixed SELECT / WITH SELECT fixtures and wraps
each in `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. It records database execution
and Neon round trip separately. Index presence is an invariant; a small live
table may legitimately choose a sequential scan, so planner index use is
recorded as evidence rather than falsely required on every run.
