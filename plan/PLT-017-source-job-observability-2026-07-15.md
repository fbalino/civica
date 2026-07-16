# PLT-017 — source and job observability

## Decision

Introduce `civica-pipeline-observability/v1`: a durable, internal ledger for
all production-pipeline outcomes. It supplements—rather than replaces—the
existing cron-delivery and Pulse-stage ledgers. One shared boundary records
every scheduled route; canonical manual commands run through an observed
runner. The record is operational metadata only: pipeline/run identity,
bounded counts, declared source version/vintage contract, source freshness
result, reliable cost where a runner supplies it, and a short safe error code.
It never retains request bodies, credentials, raw upstream payloads, or error
contents.

## Alert model

The pipeline-alert cron evaluates the latest expected UTC schedule slots,
failed/empty runs, and rejection-rate anomalies. An open alert writes a
structured content-free error to the owned Vercel Cron log and returns a
non-success terminal outcome, making the missed or failed check visible in the
same production job surface. `data/PIPELINE-OBSERVABILITY.md` will link the
existing upstream-source-breakage runbook and define the response window.

## Source review

Vercel's official cron documentation was reviewed on 2026-07-15. It confirms
that deliveries are best effort, failed deliveries are not retried by Vercel,
and overlapping or duplicate invocations are possible. Civica therefore keeps
the PLT-010 durable lease/idempotency boundary and independently checks the
expected schedule slot; a Vercel runtime log is not treated as proof that a
delivery reached the function.
