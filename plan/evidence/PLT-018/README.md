# PLT-018 — privacy-bounded exception monitoring

`civica-error-monitoring/v1` records one deterministic, content-free
fingerprint for a server, client-boundary, cron, or canonical production-script
failure. Each durable event carries only its closed surface, canonical route or
job context, safe error code, release identity, protected source-map identity,
bounded lifecycle timestamps, occurrence count, and open/resolved state.
Opaque correction/status record IDs can be linked to a known issue.

The ledger deliberately excludes exception messages, stack traces, React
digests, raw paths or path parameters, query strings, headers, cookies, IP or
account identifiers, request bodies, source-map content, and reporter prose.
The client boundary posts only a route path and one of two closed boundary
codes; server, cron, and script paths use the same bounded store. Failures to
record or prune an event never alter the reader, cron, or script outcome.

The daily `operations.error-alerts` cron route writes content-free open-alert
summaries to the Civica Atlas Vercel Runtime Logs, Fernando's owned operational
channel. The checked runbook is [`data/ERROR-MONITORING.md`](../../../data/ERROR-MONITORING.md).

`source-review.md` records the official Next.js/Vercel source-map decision;
`migration-plan.md` records the additive migration and zero-write Neon
preflight; and `verification.json` records the focused tests, static gates, and
browser smoke. Browser maps remain opt-in until the project owner enables
Vercel Protected Source Maps and sets `VERCEL_PROTECTED_SOURCEMAPS=true`; the
required post-deploy proof is queued in `plan/MANUAL-CHECKS.md`.
