# PLT-032 — Run records show what a partial Pulse ingest committed

Status: complete on 2026-09-29. Code and documentation only; nothing was
written to production.

## What was wrong

Every `pulse.v2.ingest` row in `production_pipeline_runs` since mid-August
recorded 0 rows read, 0 written, 0 rejected, and no freshness sources. Pulse's
own stage record, the raw events, and the sources table show the runs were
storing events and refreshing source freshness. `diagnosis-2026-09-29.json`
holds the read-only production evidence.

## Causes

All three are in the shared run ledger (`src/lib/platform/pipeline-observability.ts`):

1. **Counters came from one connector.** The ledger reads counters from the
   job's JSON response and took the first path, in key order, whose name ends
   in a candidate such as `fetched` or `inserted`. The ingest response lists
   per-connector reports, sorted by connector, before the run totals, so the
   ledger stored ACLED's numbers. ACLED is access-gated and reports zeros.
   The same rule recorded the one fully successful run (a manual run on
   21 September that stored 250 GDELT events) as `empty`.
2. **Freshness was skipped for failed runs.** A partial ingest returns
   HTTP 502 and is recorded as failed, but its atomic writer still commits the
   working connectors' rows and stamps their sources.
3. **IPU was never a candidate.** Even for a successful run, the ledger
   checked only the four sources registered for the job. The IPU connector
   writes and stamps `ipu_parline`, which is not registered. The registry is a
   protected Index file, so the fix does not widen it.

## What changed

- Among response paths matching a counter name, the least nested now wins and
  key order breaks ties, so `summary.totalInserted` outranks
  `summary.reports.0.inserted`. `totalUnmatched` is recognized as the run's
  rejected count.
- Refreshed sources are read from the database at finalization, through a new
  `advancedSources` method on the run store. Candidates are the sources the
  handler's writer reports in a `sourcesStamped` array (Pulse ingest and bills
  already return one), plus every registered source when the run succeeded.
  A failed run therefore records only sources its own writer reported and the
  database confirms.
- Freshness stamping itself is untouched: it still happens only in the
  writers, through the sanctioned `markSourcesSynced*` path.
- `data/PIPELINE-OBSERVABILITY.md` documents the freshness rule.

## Effect on other jobs

A read-only audit of all 42 cron routes found one other correction: the
classifications import now records its run-level `totalErrors` instead of the
World Bank block's `errors`. No other route's current pick changes. Remaining
counter oddities that this task does not change: the health-alert monitor
stores an unrelated recovery count as rejections, bills count inserts but not
updates as rows written, and factbook imports report jurisdictions in scope as
rows read.

## Why the ingest is partial every day

GDELT. Its connector failed in 96 runs from 17 August to 29 September, every
recent run, on a 10-second connection timeout to `api.gdeltproject.org`. GDELT
last answered on 21 September. Amnesty failed for three days in August and has
recovered. This is an upstream reachability problem and is not changed here.
The run record keeps these runs as failed with the summary `partial`, so the
pipeline alert remains open until GDELT is reachable or deliberately retired.

## Verification

See `verification-2026-09-29.json`.
