# PLT-016 — privacy-bounded route performance telemetry

## Decision

Add a self-hosted, server-side operational telemetry ledger rather than a
third-party reader analytics client. The ledger retains route-template request
timing, server-error counts, cache profiles, release identifiers, and cron-job
duration. It is not a behavioral analytics product.

## Boundaries

- `src/proxy.ts` starts server timing and defers request observations until the
  response has completed; development and test requests do not write telemetry.
- `instrumentation.ts` observes server errors but never passes error content to
  storage.
- `withCronJob()` records terminal job timing and schedules retention cleanup.
- `route_performance_observations` has a closed schema and 30-day retention.
- `npm run report:route-performance` is the restricted, read-only operator
  view. There is no raw telemetry reader endpoint.

PLT-016 creates migration `0037_minor_sharon_carter` but does not apply it to
the configured database. PLT-019 owns a compatible-schema staging rehearsal,
production deployment order, and live fingerprint verification.

## Acceptance mapping

| Requirement | Evidence |
| --- | --- |
| route/version/release/cache/job/error metrics | closed builder, grouped report, and alert tests |
| privacy limits | database checks, route canonicalization test, operator policy |
| retention/access | 30-day cron prune and no public raw endpoint |
| tested thresholds | pure alert fixture |
| failure isolation | injected write-failure fixture and deferred best-effort paths |
