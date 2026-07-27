# Route performance telemetry

PLT-016 defines `civica-route-performance/v1`, an operational server-side
telemetry contract. It answers whether a released route or scheduled job is
slow or failing without creating a reader-analytics ledger.

## Captured fields

Each `route_performance_observations` row contains only:

- observation time;
- a closed route template ID, never a live pathname;
- HTTP method;
- surface (`request`, `job`, or `error`) and its closed metric;
- a bounded duration in milliseconds where applicable and an HTTP status where
  known;
- cache profile from the PLT-014 route freshness registry;
- deployment release identifier; and
- this telemetry contract version.

The proxy records request duration only after a response completes. Next's
`onRequestError` hook records the distinct, content-free `server_error` metric.
The common `withCronJob()` boundary records job duration. Every write is best
effort: a rejected, timed-out, or failed telemetry operation returns control to
the original reader/job path and emits only a fixed operational log label.

The ledger never stores raw paths or path parameters, query values, headers,
cookies, IP addresses, user agents, request bodies, account identifiers, error
messages, error digests, or stack traces. The database constraints and the
static gate make those field choices closed rather than advisory.

## Retention and access

Rows are retained for 30 days. Each non-retired production cron invocation
schedules a best-effort prune after its response, so cleanup is not a reader
request dependency. There is no public reader API or dashboard for this raw
operational ledger. Access is restricted to an authorized operator with direct
database access, through `npm run report:route-performance`; that command only
reads a 24-hour grouped summary and emits route/template, cache-profile, and
release identifiers with count, p95, and average duration.

The migration is additive and initially empty. Do not run it directly against a
production database while closing PLT-016. PLT-019 owns staging application,
release/deploy ordering, migration rehearsal, and live schema-fingerprint
verification.

## Alert contract

The report evaluates fixed thresholds per route, method, cache profile, and
release ID, so a new deployment cannot be blurred into the prior release.

- request p95 exceeds 1,500 ms with at least 20 observations;
- cron job p95 exceeds 300,000 ms with at least four observations; or
- server errors exceed 2% of at least 100 observed requests.

An alert is an operator signal, not a user-visible claim and not an automatic
status-page incident. PLT-020 owns public health/status behavior and PLT-018
owns broader exception monitoring and routing.

## Source review

The implementation was checked on 2026-07-15 against Next.js's official
[Instrumentation](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation),
[after](https://nextjs.org/docs/app/api-reference/functions/after), and
[Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
references. `after()` is used because the official contract runs deferred work
after the response and is suitable for logging/analytics; Proxy is deliberately
not used for authentication or authorization.
