# Civica G4 operations-readiness report

**Contract:** `civica-g4-operations-readiness/v1`  
**Reviewed:** 2026-07-23  
**Status:** blocked  
**Waivers:** none

This report summarizes the checked operational evidence for PLT-025. It is not
a production sign-off. The generated `civica-gate-readiness-report/v1` G4
record remains blocked, and PLT-025 remains unchecked until every unwaived P0
and P1 operational finding below is closed.

## Route and exposure inventory

- `npm run validate:route-inventory` passed against 108 repository-owned
  `route.ts` files and 108 registry entries: zero phantom routes, zero stale
  entries, and zero method drift.
- Exposure counts are 11 admin, 1 chat, 42 cron, 1 embed, 3 export, 4 public
  mutation, 40 public read, and 6 Pulse coding routes.
- One documented non-blocking warning remains: Pulse coding sign-out is
  intentionally callable without an active session so it can clear an
  unusable cookie. The route has a separate reviewed logout boundary.
- `civica-rendered-module-ledger/v1` separately covers rendered pages, error
  boundaries, navigation modules, and the standalone HTML embed. Its exact
  module-level visual review remains open under EXP-001.

## Security and access controls

- The current tracked tree passes `npm run validate:secrets` with zero
  findings across 3,723 files.
- The history scanner distinguishes 28 exact non-secret historical fixture
  hashes from the one real historical Neon connection-string exposure. The
  latter remains recoverable from Git history and must be rotated by the owner;
  it is not waived or reclassified.
- Route authorization, same-origin mutation controls, durable rate limiting,
  security headers/CSP, SSRF-safe public HTTP, cron authentication,
  idempotency, signed admin sessions, revocation, and audit identity have
  checked local contracts. Provider/cross-instance and real-session smoke
  checks remain queued where named below.

## CI and release verification

- The canonical fork-safe GitHub Actions workflow is hash/byte bound, uses
  least-privilege read access, and runs the credential-free build plus browser,
  accessibility, performance, secret, lint, type, and module gates.
- Clean-checkout evidence installed the lockfile-pinned dependencies, completed
  the production build, and passed the fixture-only test suite.
- Hosted pull-request/main runs and branch-protection enforcement have not been
  observed in this report. PLT-001's owner/platform check remains open.
- The current G4 readiness record reports 244 of 306 tasks complete, 27 open P0 tasks,
  57 open P0/P1 tasks, no evidence gaps, no mirror errors, and no waivers. A
  blocked report cannot be converted to pass by successful commands.

## Jobs, freshness, and error monitoring

- `civica-pipeline-observability/v1` closes 39 scheduled and 11 canonical
  manual production pipelines with bounded run identity, outcome, counts,
  source versions, cost, freshness, and alert states.
- `civica-error-monitoring/v1` closes content-free server/client/cron/script
  fingerprints, lifecycle, correction/status links, alerting, resolution, and
  recurrence behavior.
- `civica-health-status/v1` distinguishes website, Atlas data, Atlas map, and
  Ask Civica health without exposing credentials or payloads.
- These schemas and local fixtures pass. Their new migrations, protected source
  maps, Runtime Logs alert, status-provider configuration, and safe deployed
  drills still require the staged/provider actions below.

## Backup, restoration, and recovery

- DAT-021 restored a production-read-only PostgreSQL snapshot into disposable
  local PostgreSQL 17, matched schema/data hashes, and recovered through
  archived WAL to a named point. The frozen Atlas archive also matched its bill
  of materials.
- The checked local timings were 3,319 ms for logical restore and verification,
  1,164 ms for physical base backup, and 193 ms for PITR startup.
- Provider-managed Neon PITR into a disposable branch and the recovery posture
  for externally hosted media remain explicit external gaps.

## Deployment, rollback, caches, and releases

- `civica-deployment-rehearsal/v1` passes its local nine-migration staged-order,
  compatibility, abort, validation-only deployment, cache/release boundary,
  and forward-only recovery fixtures.
- No disposable Neon/Vercel staging rehearsal has run for the current
  migration set. QA-018 therefore has no exact deployed commit/data/method
  smoke evidence, and QA-019 has no deliberately bad staged release rollback
  or forward-fix evidence.
- Conditions migrations/releases, Pulse workspace reconciliation, observability
  migrations, and other production promotions remain authority-gated. This
  report does not authorize them.

## Performance and browser support

- `civica-reader-performance-budget/v1` passed its four-route controlled
  production fixture: home, Atlas, constitution, and Record. It measures
  HTML/RSC, JS, CSS, images, fonts, requests, server response, LCP, CLS,
  interaction timing, long tasks, and Atlas initialization.
- The credential-free CI subset passed home and Record while explicitly
  skipping data-backed routes. Supported-browser degradation checks cover
  Chromium, Firefox, and WebKit plus no-JavaScript and provider-failure paths.
- These are laboratory regression ceilings, not field Core Web Vitals or a
  production-traffic claim.

## Open incidents and unwaived operational blockers

1. **Credential incident — owner:** rotate the historically exposed Neon
   password, update deployed/local configuration, and decide whether to purge
   shared Git history. The current tree is clean; the historical exposure is
   not.
2. **Hosted CI — owner/platform:** observe passing pull-request and `main`
   workflows and require the canonical `verify` job through branch protection.
3. **Staging and release smoke — owner/platform:** complete PLT-019 and QA-018
   on a disposable Neon branch and isolated Vercel environment, with jobs
   quiesced and exact release identities retained.
4. **Rollback/correction rehearsal — owner/platform:** complete QA-019 with a
   deliberately bad staged release and verify cache, artifact, status, and
   changelog consistency.
5. **Cross-instance rate limiting — owner/platform:** complete the Preview
   concurrency, forwarding-header, fail-closed outage, and recovery proof.
6. **Monitoring and status providers — owner/provider:** enable and verify
   protected source maps, safe Runtime Logs alert handling, the public status
   component configuration, and the non-notifying test incident.
7. **Provider privacy/cost controls — owner/provider:** verify the Anthropic
   retention arrangement, scoped model keys/workspaces, hard caps, and alerts.
8. **Provider recovery — owner/platform:** complete the Neon-managed PITR drill
   and decide the external-media recovery posture.
9. **Program telemetry — owner:** complete PLT-029's subscription, paid-API,
   external-human-spend, and effort ledger with no unexplained spend.
10. **Visual and release gates:** close EXP-001/015/028 and all other open P0/P1
    release blockers before G4 can pass.

## Decision

G4 operations readiness is **blocked**. Local contracts and rehearsals are
substantial and currently reproducible, but external credentials, hosted
enforcement, staging, provider controls, recovery, rollback, and owner review
remain unverified. There are zero waivers. Rerun the exact validators and
regenerate the G4 readiness report after each blocker closes.
