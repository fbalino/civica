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
- run `npm run validate:cron-safety`, `npm run validate:sync-freshness`, and
  `npm run validate:production-adapters`.

## Current official references

Reviewed 2026-07-14:

- [Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Neon — Serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [PostgreSQL — Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL — Date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [PGlite — Getting started](https://pglite.dev/docs/)
