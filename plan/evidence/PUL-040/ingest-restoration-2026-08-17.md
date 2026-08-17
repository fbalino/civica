# Pulse ingest restoration — 2026-08-17

Part of the owner-authorized subscription-runtime wave
(`plan/pulse-subscription-runtime-resolution-v1.md`, adopted 2026-08-17).
Scope: diagnose and repair the raw-event ingestion outage observed since
2026-07-29. No model was called; ingest/cluster/score remain model-free.

## Findings

1. **The Vercel scheduler stopped invoking every cron after 2026-07-30.**
   `pulse_pipeline_runs` shows no scheduled run of any stage after
   2026-07-29; every cron-fed source's `last_sync_at` stops the same day
   (bills 07:30Z, Pulse 11:00Z); the `cron_job_executions` ledger holds zero
   rows; production runtime logs show no `/api/cron/*` requests. Production
   *deployments* are healthy and current — the platform simply is not firing
   schedules. The dashboard-side cause (cron disable, plan limit, or a
   spend-management pause after the 2026-08-17 invocation-spike alert)
   requires an owner dashboard check; the Mac daily runner being built in
   this wave will drive the cycle through the authenticated idempotent cron
   routes regardless, so scheduler health stops being load-bearing.
2. **All-or-nothing ingest publication starved ingestion.** The 2026-08-09
   integration made a single failed connector suppress publication of every
   successful connector. With nine heterogeneous external feeds, at least
   one fails on most real days (GDELT on 07-29; IPU parse contract today;
   Amnesty intermittently), so even manually-invoked runs published zero
   rows (verified against production: 292 fetched, 0 inserted, HTTP 502).
3. **The IPU connector's parse contract had drifted.** The v1 API serves a
   JSON:API envelope (`data[].attributes` with `{value}` wrappers), ignores
   `date_from`, and needs `sort=-election_date`; the connector expected a
   flat `results` array and failed closed on every run.
4. **Failure paths skipped run finalization under cron execution keys**,
   leaving run rows stuck at `running` forever: 31 stuck rows (17 classify,
   14 score, July 13–29, plus the 2026-08-17 manual 502 run).

## Repairs (code, `src/lib/pulse/v2/`)

- `ingest.ts`: partial-availability policy — failed connectors still fail
  closed individually (no rows, no freshness) and are recorded as failures
  on a `partial` run, but they no longer suppress the successful subset.
  Failure paths now always finalize the run row, including cron-keyed runs.
- `upsert.ts`: the atomic publish statement can finalize a run as
  `completed` or `partial` and records connector failures on the run row,
  keeping publication + status + freshness in one statement. Freshness
  stamping is unchanged: only sources that actually gained a row are
  stamped (`markSourcesSyncedFromInsertedRowsCte`), so duplicate-only and
  failed connectors can never fake freshness.
- `sources/ipu-actions.ts`: rewritten for the JSON:API shape with
  newest-first sorting, `{value}` unwrapping, ISO2 resolution from election
  codes, and a client-side recency window; still fails closed on unknown
  shapes.
- Tests updated deliberately (not silently): the ingest partial test now
  proves the successful subset publishes while the failed connector stays a
  visible partial-run failure, the recovered source alone stamps on retry,
  and duplicate-only work still cannot restamp; the three
  "cannot be masked" connector-honesty tests keep every visibility
  assertion (recorded error, `partial` outcome, HTTP 502) with publication
  expectations updated to the new policy.

## Repairs (data, production)

- Local authorized run with the fixed code inserted 28 raw events
  (HRW 20, CIVICUS 5, IPU 3 — the restored connector delivered the Zambia,
  Benin, and Algeria elections). GDELT/Amnesty failed only from the local
  IP; production fetches them normally.
- The 31 stuck `running` run rows were finalized as `failed` with an
  explicit repair note in `failures`; no stage output from those runs was
  published. One sub-hour-old orphaned run from the diagnostic 502 remains
  for finalization with the first full cycle.

## Verification

- `ingest.test.ts`, `ingest-cron-retry.test.ts`, `failure-honesty.test.ts`,
  `cron-outcomes.test.ts`: 24/24 pass; TypeScript clean.
- `npm run validate:cron-safety`: PASS.
- Read-only production checks confirm the new rows and the repaired run
  ledger.
