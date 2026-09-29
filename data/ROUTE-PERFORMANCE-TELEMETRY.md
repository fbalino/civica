# Route performance telemetry

PLT-016 defines `civica-route-performance/v1`, an operational server-side
telemetry contract. It answers whether a released route or scheduled job is
slow or failing without creating a reader-analytics ledger.

## Collection scope

The proxy runs only for `/api/*` (`matcher: ["/api/:path*"]`). Within that
scope, `isRequestTelemetryEligible()` admits only route handlers whose cache
policy is `public-live` or `private-live`. Those handlers query the database
in the same request, so a sampled write never wakes an idle database.

Page documents are never recorded. Database-backed pages are served from the
page cache (PLT-033, APR-D177), and a write for each sampled page view would
keep the database awake around the clock for crawler traffic alone. The proxy
also never runs for the `_next/` tree, files served from `public/`,
`/downloads/*` releases, `favicon.ico`, `robots.txt`, or `sitemap.xml`.
Checked-artifact routes, immutable releases, and unknown `/api/*` paths reach
the proxy but are not eligible, because none of them read the database.

Server errors keep their own unsampled path through `onRequestError`, so a
page that fails while rendering is still recorded as a `server_error` row.
Because page documents contribute no request samples, the `request_p95` and
`server_error_rate` alerts evaluate API routes only; page render latency is
visible in Vercel's function logs and in the daily `operations.refresh-pages`
run duration.

## Sampling

Matched requests contribute a uniform random sample rather than one row each.
The rate is 1 in 20 (5%), held in `ROUTE_PERFORMANCE_REQUEST_SAMPLE_RATE`, and
the decision lives in `shouldRecordRequestPerformanceSample()`, whose random
source is injectable and which fails closed on an unusable draw.

The sample is uniform on purpose. Exempting slow requests would retain the tail
while discarding the body of the distribution and would stop the stored `p95`
being a percentile of real traffic. The proxy also cannot observe the response
status, so no error-based exemption is available there.

Only the `request` surface is sampled. `job_duration_ms` and `server_error`
rows are unsampled, which has two consequences for anything reading this
ledger:

- Latency statistics — `p95`, average, and the `request_p95` alert — are
  unbiased on a uniform sample and need no correction. The `request_p95` gate
  still counts stored observations, because it measures how reliable the stored
  percentile is; under sampling a route needs roughly 20/rate real requests in
  the window before it can fire.
- Counts are not throughput. `sampleCount` on a `request_duration_ms` row is a
  stored-observation count. `estimatedRequestPopulation()` scales it back, and
  the `server_error_rate` alert compares unsampled errors against that
  estimated population rather than the raw sampled count. The report emits
  `requestSampleRate` and a per-row `estimatedRequestCount` so an operator
  cannot read a sampled count as request volume.

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
release identifiers with stored count, estimated request count, sample rate,
p95, and average duration.

The migration is additive and initially empty. Do not run it directly against a
production database while closing PLT-016. PLT-019 owns staging application,
release/deploy ordering, migration rehearsal, and live schema-fingerprint
verification.

## Alert contract

The report evaluates fixed thresholds per route, method, cache profile, and
release ID, so a new deployment cannot be blurred into the prior release.

- request p95 exceeds 1,500 ms with at least 20 stored observations;
- cron job p95 exceeds 300,000 ms with at least four observations; or
- server errors exceed 2% of at least 100 estimated requests, where the
  estimate is the sampled request count scaled by the inverse sample rate.

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
