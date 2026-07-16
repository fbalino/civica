# PLT-017 — source/job observability and freshness alerts

`civica-pipeline-observability/v1` is an internal, privacy-bounded ledger for
the 37 scheduled and 11 canonical manual production pipelines. The durable
record contains one logical run ID, start/end/status, nullable-but-explicit
read/write/rejection counters, registered source version/vintage handles,
reliable runner-supplied cost, closed failure code, and source freshness result.
It never stores source payloads, URLs, request bodies, credentials, or exception
text.

`source-review.md` records the Vercel Cron source review. `migration-plan.md`
records the additive migration and local catalog validation. The shared
runbook is `data/OPERATIONAL-RUNBOOKS.md` under **Upstream data-source
breakage**. `verification.json` records the relevant tests and the successful
configured-database zero-write preflight. A broad build attempt is separately
scoped: its remaining failure is the unrelated user-owned Index-presentation
change-control guard, not the PLT-017 contract.
