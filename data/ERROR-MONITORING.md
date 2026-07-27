# Error monitoring

PLT-018 defines `civica-error-monitoring/v1`: a privacy-bounded exception
ledger for server, client-boundary, cron, and manually invoked production
pipeline failures.

## What is retained

Each deduplicated `error_monitoring_events` row holds only a closed surface,
route template where applicable, cron/script job ID where applicable, closed
error code, release ID, protected source-map identity, timestamps, occurrence
count, and open/resolved state. Its companion `error_monitoring_issue_links`
table can point to an opaque correction-log or status-page record ID.

It never retains an exception message, stack trace, React digest, raw path or
path parameter, query string, headers, cookies, IP address, user agent,
request body, account identifier, source-map content, or reporter prose.
Repeated failures reopen the existing signature; they do not create a new
record merely because an operator resolved an earlier occurrence.

## Source maps and release identity

Every event has the release ID selected by `VERCEL_GIT_COMMIT_SHA`, then
`GIT_COMMIT_SHA`, then `VERCEL_DEPLOYMENT_ID`, and a matching
`nextjs-protected/<release-id>` source-map identity. Turbopack debug IDs and
server source maps are enabled in `next.config.ts`.

Browser maps are generated **only** when
`VERCEL_PROTECTED_SOURCEMAPS=true`. Before setting that production variable,
the Vercel project owner must enable **Protected Source Maps** in Project
Settings → Deployment Protection and save it. Vercel then serves `.map` files
only to authorized project/deployment users; do not enable the variable on an
unprotected deployment and do not substitute `productionBrowserSourceMaps:
true` directly. Verify a deployment while signed into Vercel Debug Mode, then
record the deployment ID in the release evidence.

## Alert and response contract

`/api/cron/operations/error-alerts` runs daily at 23:50 UTC. It emits open
alerts to the Civica Atlas Vercel Runtime Logs, the owned operational channel
reviewed by Fernando. It returns a successful cron result even with alerts
open, so the monitoring job cannot recursively create an alert about itself.
A Vercel Log Drain may forward the same structured log to another owned
channel, but must preserve the content-free payload.

Use `npm run report:error-monitoring` for the same bounded, read-only summary.
It exits nonzero while open alerts remain. To attach a correction or status
record and optionally resolve a known issue, use:

```sh
npm run manage:error-monitoring -- --event=<event-uuid> --link=correction:<correction-uuid> --resolve
npm run manage:error-monitoring -- --event=<event-uuid> --link=status:<status-record-id>
```

The second command deliberately accepts record IDs, never a public status URL
or description. Review the actual correction/status record before resolving an
event. PLT-020 owns public health/status behavior; an alert alone is not a
public incident claim.

## Retention and verification

Rows are retained for 90 days. Non-retired cron invocations schedule best-effort
pruning; pruning or monitoring-store failure cannot alter the original reader,
cron, or script outcome. There is no public raw-error API.

Run `npm run validate:error-monitoring` after changing instrumentation, error
boundaries, cron/script execution, source-map configuration, monitoring schema,
or the runbook. The focused suite seeds a cron error, verifies that it appears,
links it to both correction and status records, resolves it, and verifies that a
repeat reopens the same fingerprint.
