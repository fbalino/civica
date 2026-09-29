# PUL-044 — GDELT is retrieved from the owner-Mac runner

Status: open. The code change is ready; the task closes after the first
production cycle described under "Closing evidence".

## Why

The scheduled `pulse.v2.ingest` route ended partial on almost every run since
mid-August because the GDELT connector could not connect to
`api.gdeltproject.org` from Vercel (10-second connect timeout, 96 runs from
17 August to 29 September; see `plan/evidence/PLT-032/diagnosis-2026-09-29.json`).
The only Vercel success since mid-August was a manual delivery on
21 September. GDELT itself is up: on 29 September it accepted a connection
from the owner's Mac in 0.6 seconds, and a zero-write dry run of the real
connector there retrieved 250 articles (`dry-run-2026-09-29.json`). Fernando
chose to move GDELT retrieval to the Mac (APR-D176).

## What changed

- `ingestPulseV2` accepts `onlyConnectors` or `skipConnectors`. An unknown or
  conflicting selection fails before the Pulse run row, any retrieval, or any
  write.
- `PULSE_MAC_RETRIEVED_CONNECTORS` names the connectors the Mac retrieves
  (currently `gdelt`). The scheduled route skips them and still runs the other
  eight connectors.
- `scripts/sync-pulse-v2-ingest.ts` takes `--connectors=<ids>`, prints counter
  lines the production ledger wrapper reads, and exits nonzero when any
  retrieved connector fails.
- `scripts/pulse/mac-daily-runner.sh` retrieves GDELT right after the Vercel
  ingest call and before local clustering, through
  `run:production-pipeline --pipeline=pulse.v2.ingest`, so each Mac run has a
  production ledger row.
- The ledger wrapper reads `.env.local` like the other production scripts;
  an injected environment still wins.

Unchanged: the Pulse method, connector list, GDELT query and 24-hour window,
source basket, atomic writer, and freshness stamping. The public
source-coverage state already reads each connector only from runs that
attempted it, so a Vercel run without GDELT does not mark it degraded and a
Mac run with only GDELT does not affect the other feeds (tested).

## Trade-off

GDELT now depends on the Mac being awake at the daily 13:30 UTC run, like
clustering and classification already do. A missed day is not backfilled; it
stays visible in the run ledger and the public source-coverage state.

## Closing evidence (after merge and deployment)

1. The owner merges and deploys; the owner's main checkout is updated so the
   launchd runner uses the new script.
2. The next scheduled Vercel ingest runs without a GDELT connector and finishes
   complete, unless another connector fails.
3. The next Mac run records a `pulse.v2.ingest` ledger row, stores or
   de-duplicates GDELT events, stamps `gdelt` freshness, and
   `/api/v1/pulse/source-coverage` shows GDELT operating.
