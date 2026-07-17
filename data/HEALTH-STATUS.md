# Production health and public-status contract

`civica-health-status/v1` is Civica Atlas’s content-free availability contract.
It serves both independent monitors and the owner-operated public status page:

- public endpoint: `GET /api/health`;
- owner monitor: `operations.health-alerts`, every 15 minutes through Vercel
  Cron; and
- public communication: <https://statuspage.incident.io/civica-atlas>.

The endpoint is request-live and explicitly `no-store`. The verified all-path
Vercel WAF supplies its flood ceiling; Civica deliberately does not put the
database-backed application limiter in front of a database availability probe.
It has no request body,
authentication, user identity, provider configuration, URL, error text, stack,
or credential field. It returns the checked timestamp, overall state, and only
the five closed component IDs, states, optional flags, and closed summaries.
An unavailable application or database produces HTTP `503`; an asset,
freshness, or optional-service issue leaves the endpoint HTTP-reachable (`200`)
and is expressed in the component report. An unexpected handler failure uses
the common safe `503` response.

## Probes

| Component | Probe | State boundary |
| --- | --- | --- |
| `application` | A successful execution of the Node route handler. | This component is operational when the report is returned. A route-level failure is a failing endpoint. |
| `database` | Bounded `SELECT 1` through the production Neon/Drizzle boundary. | Failure is an immediate core outage and returns `503`. |
| `critical_assets` | A five-second, credential-free `HEAD` probe of the active map asset: the configured HTTPS PMTiles archive, otherwise the OpenFreeMap style. | Any non-success, timeout, malformed/non-HTTPS configuration, or network failure marks the map asset unavailable. No PMTiles bytes are downloaded. |
| `scheduled_data_freshness` | The retained pipeline ledger against every registered expected cron slot, using PLT-017’s two-hour grace and missed/failed/empty/anomalous rules. | Open alerts degrade data freshness; an unreadable ledger is `unavailable`, never silently “fresh.” |
| `model_dependent_optional_services` | Presence-only configuration assessment for Ask Civica and the three default Pulse classifier voters. | It never turns the core site unavailable and never calls a paid model provider. It distinguishes Ask Civica unavailable, limited automated classification, and all optional model services unavailable. |

The health response and log intentionally omit the active asset URL, affected
pipeline IDs, raw model/provider names, environment-variable names, error text,
and every value from the environment.

## Incident threshold and ownership

Fernando Balino is the accountable owner. The `operations.health-alerts` Cron
writes one safe `[health-alert]` JSON line to Vercel Runtime Logs whenever a
component is not operational. It intentionally succeeds after reporting an
open condition, so the monitor does not create a second failed-pipeline alert.

Use these fixed thresholds:

1. **Immediate publication:** application or database is unavailable. Publish
   an Incident.io incident as **Investigating** and mark `Website` and `Atlas
   data` affected.
2. **Persistence-gated publication:** the same map asset, scheduled-data
   freshness, or Ask Civica condition appears in **two consecutive 15-minute
   health-monitor observations**. Publish as **Investigating** and mark,
   respectively, `Atlas map`, `Atlas data`, or `Ask Civica` affected.
3. **Observe only:** a single non-core observation or limited back-office
   automated classification. Investigate and retain the safe log, but do not
   create a public incident yet.

The Incident.io page is currently updated manually: no Incident.io credential,
webhook, or auto-publish rule is stored in Civica. In Incident.io, open the
public status page, select **Publish incident**, choose the named component(s),
and use the status sequence **Investigating → Identified → Monitoring →
Resolved**. The current provider procedure was checked on 2026-07-16 against
[Incident.io’s publishing guide](https://docs.incident.io/status-pages/publishing-incidents).
That guide confirms the dashboard flow and the four incident states; it does
not make an internal health log a public incident by itself.

On the next provider-admin review, Fernando must ensure the status page’s
component labels are exactly `Website`, `Atlas data`, `Atlas map`, and `Ask
Civica`. This repository does not claim that provider-side configuration has
already been changed.

## Drill and recovery

`plan/evidence/PLT-020/health-status-drill.json` records the repeatable drill:

- database failure returns a safe `503` and immediately selects `Website` plus
  `Atlas data` for publication;
- a missed scheduled run is observed once, then selects `Atlas data` after the
  second simulated observation;
- a failed map probe separately selects `Atlas map`; and
- absent Ask Civica configuration remains a core-site `200` but separately
  selects `Ask Civica` after the second observation.

For any real incident, preserve only the deployment identifier, safe health
summary, timestamps, selected status-page components, and recovery proof. Do
not retain a raw exception, asset URL, model/provider configuration, or
credential. Resolve the public incident only after two healthy monitor runs
and a reader/browser verification of the affected surface.

Run the deterministic closure gate with:

```sh
npm run validate:health-status
```
