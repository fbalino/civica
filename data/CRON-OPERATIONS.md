# Cron delivery and recovery

**Contract:** `civica-cron-delivery/v1`
**Owner:** Civica platform operations
**Last reviewed:** 2026-07-14

This document explains how Civica's deployed scheduled jobs are authenticated,
deduplicated, serialized, retried, and investigated. The build-time source of
truth is `src/lib/api/cron-job-registry.ts`, which closes the scheduled adapter
registry against `vercel.json`.

## What the common boundary guarantees

Every route under `/api/cron/**` exports the same wrapped handler for `GET` and
`POST`.

1. The request must carry `Authorization: Bearer $CRON_SECRET`. A missing
   server secret, missing header, or wrong value returns the same `401` before
   any database work.
2. The registered job ID must match the exact request path.
3. A PostgreSQL job-wide lease allows only one active run of that job across
   application instances. A duplicate of that same logical delivery receives
   `202 job_in_progress`. A different delivery that cannot be recorded or
   queued receives an explicit `503 job_busy`; neither enters the job handler.
4. A scheduled delivery is identified by its registered job, route, and UTC
   schedule slot. Once it succeeds, another delivery for the same slot receives
   `200 duplicate_suppressed` without repeating the handler.
5. A failed or abandoned delivery can retry the same logical execution up to
   three total attempts. Every attempt has a monotonically increasing fence;
   an old worker cannot finalize a newer attempt.
6. The handler's real HTTP result is recorded before that result is returned.
   A `2xx` JSON response containing `ok: false` is normalized to failure, and a
   non-`2xx` JSON response containing `ok: true` is normalized to `ok: false`.
   If final bookkeeping cannot be confirmed, the caller receives `503` rather
   than an unrecorded success.

The lease lasts 30 minutes. The build gate proves every cron function's
declared or platform-default maximum duration leaves at least ten minutes of
lease margin.

## Scheduled and manual requests

Vercel's normal scheduled request is an authenticated `GET` with no query
parameters. It needs no extra header because the registered UTC schedule slot
is its durable identity.

Every `POST`, and every `GET` with query parameters such as `?dryRun=1`, is a
manual request and must also carry an `Idempotency-Key` header. The key must be
1–120 characters from `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, or `-`.

Example manual dry run:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" \
  -H "Idempotency-Key: officeholders-dry-run-2026-07-14-a" \
  "https://civicaatlas.org/api/cron/factbook/sync-officeholders?dryRun=1"
```

Use one key for one exact method, path, and query. Reuse that same key to retry
the same failed request. Reusing it with changed inputs returns
`409 idempotency_key_conflict`. A successful key remains a durable no-op on
future reuse; it does not reset at midnight or at the next schedule slot.

The database stores only domain-separated SHA-256 identities for requests and
manual keys. It does not store the bearer secret, raw `Idempotency-Key`, request
body, upstream payload, or error text.

## Delivery model and writer responsibility

The system is deliberately honest about its limit: it provides durable
at-least-once recovery, not a claim of magical exactly-once execution. A
process can be terminated after a business write commits but before the cron
attempt is finalized. In that case a later retry may enter the handler again.

That retry is safe because the scheduled ingestion/sync writers are required
by DAT-012 to converge on the same canonical state when applied twice. The
job-wide lease prevents overlap, the delivery ledger suppresses known completed
duplicates, and the idempotent writer contract closes the crash gap. New cron
jobs must satisfy both contracts before being added to `vercel.json`.

Vercel delivery is best effort: a run can be missed, duplicated, or overlap a
prior long run, and Vercel does not automatically retry a failed invocation.
This is why Civica uses both database locking and reconciliation-style writers.

## Success and freshness

A run advances `sources.last_sync_at` only through the sanctioned
`markSourcesSynced*` API family and only after the complete aggregate job
succeeds with eligible rows. Atomic writers use
`markSourcesSyncedTransactionQuery()` or
`markSourcesSyncedFromInsertedRowsCte()` so domain rows and freshness commit
together. Jobs with multiple stages or connectors capture candidate freshness
and flush it once at the end. A partial officeholder portrait pass, a failed
classification stage, or any failed Pulse ingest connector returns a
non-success result and does not advance shared freshness.

Dry runs never advance freshness. A monitoring or verification job may expose
`healthOk: false` separately from its execution outcome so operators can tell
"the check ran" from "the checked system is healthy."

### Daily page refresh (PLT-033)

Database-backed public pages are served from the page cache and declare a
24-hour `revalidate` backstop (APR-D177). `operations.refresh-pages` runs at
10:00 UTC, after the day's bills, factbook, and Pulse jobs. It reads the
sitemap, calls `revalidatePath("/", "layout")` so every cached page is marked
for re-rendering, then requests each cacheable sitemap URL: same origin, no
query string, and not listed in `LIVE_PAGE_ROUTES`.

- Four workers each spend at least two seconds per URL, so at most two page
  renders start per second. That keeps the database load bounded even though
  Vercel re-renders an invalidated page in the background, and it stays far
  below the 600-requests-per-minute firewall ceiling.
- Each request times out after 45 seconds. No new request starts after 640
  seconds; a URL left over is still invalidated and renders on its next
  visit. The response reports `rowsRead` (targets), `rowsWritten` (pages
  warmed), `rowsRejected` (failed requests), and `pagesSkipped`.
- A sitemap with no country pages, or a configured database that fails while
  building it, is a failed run. A run in which no page warms returns
  `502 warm_unavailable`. Many failed pages make the pipeline row
  `anomalous`, which `operations.pipeline-alerts` reports.
- `?dryRun=1` (with an `Idempotency-Key`) lists the targets without
  invalidating or requesting anything.
- The job is excluded from automatic recovery because it can run for about
  eleven minutes. A missed or failed day is covered by the pages' own 24-hour
  backstop; re-run it manually with a new key after a large manual import.

At 849 sitemap URLs on 2026-09-29, about 830 are warm targets, so a run takes
roughly seven to nine minutes.

### Atlas history identity

Scheduled Atlas writers that append public change history require a deliberate
`CIVICA_ATLAS_RELEASE_ID`. The CIA cabinet route validates it before selecting
a shard, reading the domain database, or crawling CIA pages; its dry run uses
the same check. The current live routine-refresh revision is
`atlas-routine-refresh-2026-09-17`. It names mutable routine updates under the
existing public method and is not the frozen `atlas-2026-07-11` publication, a
deployment identifier, or the one-off capital repair. A later revision must be
named deliberately and documented before the environment value is changed.

### CIA World Leaders cabinet roster (DAT-037)

`factbook.cia-cabinets` reconciles each country's stored cabinet with the CIA
World Leaders page. The page lists titles and current holders and one "Last
Updated" date; it publishes no appointment dates, so the job never writes a
term start or end date.

- A term is identified by office and person. Each listed title's current
  holders become exactly the people the page lists, including every holder of
  a title listed several times. A title the page no longer lists releases its
  list position and its holders become former holders; nothing is deleted.
- The page date is one `cabinet_roster_last_updated` statement on the
  executive body, with a SHA-256 of the normalized roster in `source_hash`.
  It changes only when the date or roster content changes.
- `retrieved_at` on these statements records the retrieval that established
  their current content, not the latest check. Per-country verification is the
  shard's successful execution record plus the `countriesVerified` and
  `countriesUnchanged` counters in the pipeline row.
- An unchanged shard is a successful run with `totalRowsWritten: 0` and no
  freshness stamp. `no_rows` now means no country could be verified.
- Each country commits in one transaction. Closed skips:
  `cabinet_office_identity_conflict` (a listed title matches a head or other
  non-roster office, or two stored offices share it),
  `cabinet_person_identity_conflict` (a listed name matches more than one
  stored person at the deciding tier), and `cabinet_roster_guard_failure` (the
  page would retire an implausible share of the cabinet, or its date is older
  than the stored roster date). None is retried automatically; investigate the
  named country.

Deployment caution: the pre-DAT-037 importer identifies terms by office,
person, and page date. Once the one-time repair has cleared stored dates,
running the old importer again would re-create dated duplicates on its first
visit to every country. Disable the project's cron jobs before any Instant
Rollback past DAT-037, and prefer a forward fix. The repair runbook is
`plan/evidence/DAT-037/README.md`.

## Durable records

Authoritative migration `0034_superb_the_fallen` creates three internal
operational relations:

- `cron_job_executions`: one logical scheduled slot or manual key, its request
  identity, retry count, and terminal HTTP outcome;
- `cron_job_attempts`: every acquired attempt, including expired, failed, and
  successful attempts; and
- `cron_job_leases`: the current job-wide holder and monotonically increasing
  fence, retained even while idle.

Execution and attempt evidence cannot be deleted or truncated. Completed
attempts cannot be rewritten. Lease and retry transitions are constrained by
database triggers and versioned PostgreSQL functions. Lease decisions use the
database clock after obtaining the job-row lock.

Authoritative migration `0035_equal_marvex` adds
`pulse_classification_delivery_bindings`. Each authenticated
`pulse.v2.classify` execution key is immutably bound to one classification
pipeline run. A later schedule slot may adopt the same unfinished run, but a
retry first resolves its retained binding before reading newer queue work.
The insert guard rejects another cron job or Pulse stage, and update, delete,
and truncate operations are rejected.

## Response guide

| Status | Meaning | Operator action |
| --- | --- | --- |
| `200 completed` | Handler and final bookkeeping succeeded. | None. |
| `200 duplicate_suppressed` | This successful logical delivery was already recorded. | None; do not invent a new manual key. |
| `202 job_in_progress` | This same logical delivery already owns the job-wide lease. | Respect `Retry-After`; inspect only if it outlives the lease. |
| `400 idempotency_key_required` | A manual/parameterized request omitted its key. | Repeat with a stable key. |
| `400 invalid_idempotency_key` | The key violated the bounded format. | Choose a compliant non-secret key. |
| `401` | The bearer is absent, wrong, or the server secret is unset. | Verify the Vercel environment without logging the value. |
| `405 method_not_allowed` | A method other than `GET` or `POST` reached the boundary. | Correct the caller. |
| `409 idempotency_key_conflict` | One manual key was reused for different inputs. | Investigate; use the old exact request or a genuinely new key. |
| `5xx handler_failed` | The job reported a real failure or partial result. | Correct the upstream/job problem, then retry the same logical request. |
| `503 retry_limit_exhausted` | Three attempts for this logical request failed. | Investigate before starting a new manual key. |
| `503 job_busy` | A different delivery owns the lease; this request was not recorded or queued. | Respect `Retry-After`, then repeat a manual request with the same key. A missed scheduled slot requires operator review because Vercel does not retry it. |
| `503 delivery_control_unavailable` | The ledger/lease could not be acquired. | Treat the job as not started; check database availability. |
| `503 delivery_finalization_failed` | The handler returned, but durable completion was not confirmed. | Inspect the ledger before retrying; reuse the same key/slot. |

## Automatic scheduled recovery

The existing `operations.health-alerts` run also checks for bounded recovery
work every 15 minutes. It re-delivers only an existing scheduled execution that
is still within 48 hours, has attempts remaining, and is either an expired
running attempt or a failed attempt with a closed transient outcome
(`upstream_timeout`, `upstream_rate_limited`, `upstream_unavailable`,
`upstream_network_error`, or `pipeline_observability_unavailable`). The first
retry waits 15 minutes and the second waits 60 minutes; the shared three-attempt
cap remains authoritative. Each health run dispatches at most four executions.

Before acquiring a target, the destination route reads the retained row again
and rejects a missing, repaired, capped, non-transient, or currently leased
execution. It then uses the original execution key, schedule slot, job-wide
lease, and fencing path. The boundary passes that retained slot to handlers as
trusted internal context so calendar-derived work cannot change across
midnight. Dispatch is limited to registered routes on the canonical Civica
origin, uses the cron bearer only in an authorization header, and never follows
redirects.

Generic handler exceptions, invalid configuration, authentication or endpoint
errors, schema/mapping failures, empty/anomalous results, monitoring jobs, and
`pulse.v2.classify` are not retried automatically. `pulse.v2.cluster` is also
excluded because its intentionally degraded Vercel path lacks the local ONNX
runtime. The 800-second Wikidata and officeholder routes remain operator-run so
they cannot consume the health monitor's own finalization window; all dispatched
recoveries have a 650-second transport deadline. A missed slot has no execution
row and remains a distinct alert requiring investigation; recovery never
invents or backfills a missed run. Automatic retry also never advances source
freshness unless the retried handler commits eligible rows through the normal
freshness API.

The pre-launch reconciliation verifier treats `warn` as an advisory completed
check: it returns `200 completed_with_findings` with `healthOk: false`. A true
`fail` remains a failing `503` execution. This does not change the strict live
release-quality validator or any publication gate.

The health and pipeline monitors also use existing cron execution outcomes as
a content-free transition ledger. Health incidents open after two consecutive
non-core observations (core application/database outages open immediately),
repeat at most once per 24 hours while unchanged, and emit one recovery line.
Pipeline alert sets open immediately, repeat after 72 hours while unchanged,
and emit one recovery line. These transitions suppress duplicate Runtime Log
lines without hiding current health payloads or changing pipeline-alert HTTP
failure status.

## Investigation queries

Use read-only queries and bound the job ID/time window. Do not edit these
relations manually.

```sql
SELECT job_id, trigger_kind, schedule_slot, request_mode, status,
       attempt_count, max_attempts, completed_at, response_status, result_code
FROM cron_job_executions
WHERE job_id = $1
ORDER BY created_at DESC
LIMIT 25;
```

```sql
SELECT attempt_id, ordinal, fence, status, started_at, completed_at,
       response_status, result_code
FROM cron_job_attempts
WHERE execution_key = $1
ORDER BY ordinal;
```

```sql
SELECT job_id, lease_fence, lease_expires_at, execution_key, attempt_id
FROM cron_job_leases
WHERE job_id = $1;
```

For a Pulse classification retry, inspect the immutable handoff before
considering any new queue work:

```sql
SELECT b.execution_key, b.classification_run_id, b.created_at,
       r.status, r.started_at, r.completed_at
FROM pulse_classification_delivery_bindings AS b
JOIN pulse_pipeline_runs AS r ON r.id = b.classification_run_id
WHERE b.execution_key = $1;
```

Reuse the same authenticated delivery key when recovering a manual classify
request. Never repoint or delete a binding to make newer work appear eligible.

If a lease is genuinely abandoned, do not clear it by hand. After expiry, the
next authenticated delivery atomically marks the old attempt expired, advances
the fence, and acquires a new lease. Repeated failure at the cap requires a new
operator decision and a new manual key; never rewrite or delete the evidence.

## Change checklist

Before adding or changing a cron job:

- register the production adapter, deployment schedule, and exact runtime job
  ID together;
- use `withCronJob()` once and export its result as both `GET` and `POST`;
- keep `runtime = "nodejs"` and `dynamic = "force-dynamic"`;
- make the underlying writer repeatable and dry-runnable;
- aggregate freshness until every required stage succeeds;
- return non-`2xx` with `ok: false` for execution failures or partial work;
- add source-shaped repeatability and outcome fixtures; and
- classify transient failures with a closed safe outcome so recovery cannot
  mistake a configuration, endpoint, schema, or data-quality defect for an
  outage;
- run `npm run validate:cron-safety`, `npm run validate:sync-freshness`, and
  `npm run validate:production-adapters`.

## Current official references

Reviewed 2026-07-14:

- [Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Neon — Serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [PostgreSQL — Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL — Date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [PGlite — Getting started](https://pglite.dev/docs/)
