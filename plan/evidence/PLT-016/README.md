# PLT-016 — route performance telemetry

The checked `civica-route-performance/v1` contract limits telemetry to server
route templates and bounded operational metadata. `source-review.md` records
the official Next.js source review; `migration-plan.md` records the zero-write
preflight for the new additive relation; and `verification.json` is the final
command record.

The telemetry relation is intentionally not applied by this completed task.
PLT-019 owns application to staging/production and the live schema fingerprint.

The final production gate passed on 2026-07-15. The configured database remains
untouched: its zero-write preflight records the new relation as missing, while a
disposable PostgreSQL catalog check established the checked post-migration
fingerprint. See `verification.json` and `migration-plan.md`.
