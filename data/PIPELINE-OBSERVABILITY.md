# Production-pipeline observability

`civica-pipeline-observability/v1` is the internal operational ledger for
registered Atlas, Index, Conditions, and Pulse production pipelines. It is not
reader analytics or a source archive. Each run records its pipeline and run
identity, start/end/status, bounded read/write/rejection counters, registered
source version/vintage handles, source freshness result, a reliable cost only
when the runner supplies one, and a short safe failure code. It never stores a
request body, credentials, raw publisher data, source URLs, or exception text.

Scheduled routes create a run only after PLT-010's authenticated delivery lock
has been acquired. Canonical manual production commands run through
`npm run run:production-pipeline -- --pipeline=<id> -- <command>` and retain
the same record. A failed start or terminal persistence causes a cron delivery
to fail rather than claim an unobserved successful source run.

## Alerts and response

The daily `operations.pipeline-alerts` Vercel Cron evaluates the most recent
expected UTC slot after a two-hour grace period for a missed run, plus the most
recent failed, empty, or rejection-rate-anomalous runs. Open alerts produce a content-free
structured Vercel Cron log and a non-success job response. The accountable
owner is Fernando Balino. Within one business day, follow the **Upstream
data-source breakage** runbook in `data/OPERATIONAL-RUNBOOKS.md`: contain the
affected source, preserve the safe run record and unchanged freshness state,
repair or retry idempotently, then verify plausible counts and
`npm run validate:sync-freshness`.

Vercel's official Cron documentation was verified on 2026-07-15. Cron
delivery is best effort, failed deliveries are not retried by Vercel, and
overlap/duplicate delivery is possible; that is why a retained run record and
expected-slot alert are both required. The platform's cron log is the owned
alert channel until PLT-018 adds broader exception-routing infrastructure.

## Operator readout

Run `npm run report:pipeline-observability` with database access to print the
current open alert set. It returns nonzero when any alert is open, making it
suitable for an on-demand operational check without exposing a public endpoint.
