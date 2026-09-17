# Civica G4 operations-readiness report

**Contract:** `civica-g4-operations-readiness/v1`
**Reviewed:** 2026-09-17
**Status:** blocked
**Waivers:** none

This report summarizes the checked operational evidence for PLT-025. It is not
a production sign-off. The generated `civica-gate-readiness-report/v1` G4
record remains blocked, and PLT-025 remains unchecked until every unwaived P0
and P1 operational finding below is closed.

## Route and exposure inventory

- `npm run validate:route-inventory` passed against 109 repository-owned
  `route.ts` files and 109 registry entries: zero phantom routes, zero stale
  entries, and zero method drift.
- Exposure counts are 12 admin, 1 chat, 42 cron, 1 embed, 3 export, 4 public
  mutation, 40 public read, and 6 Pulse coding routes.
- One documented non-blocking warning remains: Pulse coding sign-out is
  intentionally callable without an active session so it can clear an
  unusable cookie. The route has a separate reviewed logout boundary.
- `civica-rendered-module-ledger/v1` separately covers rendered pages, error
  boundaries, navigation modules, and the standalone HTML embed. Its exact
  module-level visual review remains open under EXP-001.

## Security and access controls

- The current tracked tree passes `npm run validate:secrets` with zero
  findings.
- The history scanner distinguishes 28 exact non-secret historical fixture
  hashes from the one real historical Neon connection-string exposure. The
  exposed owner credential was rotated independently on production main and
  the retained recovery branch on 2026-07-29; fresh old credentials are
  rejected and replacement owner access works. The invalid bytes remain
  recoverable from Git history and registered by non-reversible hash pending
  Fernando's separate history-purge decision.
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
- The fixed local G4 matrix was rerun on 2026-07-29 from the dedicated release
  worktree at `b8351519`: master-plan integrity, verification-matrix
  validation, the unit suite, typecheck, lint, and the canonical
  credential-free production build all passed. The worktree had no
  `.env.local` or database variable; exact command durations and the local
  dependency-tree limitation are retained under `plan/evidence/QA-021/`.
- Hosted pull-request and main runs passed on 2026-09-17, including
  [PR #29](https://github.com/fbalino/civica/actions/runs/35265105969),
  [main](https://github.com/fbalino/civica/actions/runs/35266026305),
  [PR #30](https://github.com/fbalino/civica/actions/runs/35266056646), and
  [PR #27](https://github.com/fbalino/civica/actions/runs/35266075382).
  PLT-001 remains complete. A later authorized September 17 change added the
  active default-branch ruleset requiring PRs, `verify`, Vercel, current-base
  checks, resolved conversations, and squash merge, with no bypass actors.
  PR #35 passed both required checks and merged through that protected path.
  Settings evidence is retained under `plan/evidence/PLT-031/`.
- The current G4 readiness record reports 266 of 312 tasks complete, 22 open P0 tasks,
  43 open P0/P1 tasks, no evidence gaps, no mirror errors, and no waivers. A
  blocked report cannot be converted to pass by successful commands.

## Jobs, freshness, and error monitoring

- `civica-pipeline-observability/v1` closes 39 scheduled and 12 canonical
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

- **September 17 cleanup-release checkpoint:** PLT-030 is complete. Main `5203cb7b`
  reached Ready at `dpl_77DvkLZewq1hzgf2kH45e1jUPnL7` with both canonical
  domains attached. The inventory prerequisite, critical dependency repair,
  durable 229-capital source repair, and selected sharing card are deployed.
  Exact HTTP/health, reader, metadata, and image-byte evidence is retained in
  `plan/evidence/PLT-030/production-release-check-2026-09-17.json`.
  Application, database, and critical assets are operational; existing
  freshness alerts and optional classification limits keep overall health
  degraded. Eighteen lower-severity dependency findings remain. Neither this
  deployment nor the bounded browser check is a G4 or academic sign-off.
  The capital backup, restore, atomic apply, zero-write repeat, non-target
  invariants, and ordinary-cache rehearsal are recorded in
  `plan/evidence/PLT-030/canonical-capital-repair-2026-09-17.json`.
  The earlier July records below are historical, not current alias evidence.

- `civica-deployment-rehearsal/v1` passes its local 18-migration staged-order,
  compatibility, abort, validation-only deployment, cache/release boundary,
  and forward-only recovery fixtures.
- The 2026-07-27 exact-candidate rehearsal migrated a disposable Neon child
  through authoritative head `0051`, published and replayed the bound
  Conditions release, rebuilt the Index pointers, retained a deterministic
  model-free Pulse successor, deployed candidate `61351a43` to a protected
  Vercel Preview, and passed release, cache, protected-route, idempotent
  non-model dry-run, unchanged-freshness, API, responsive-browser, migration,
  schema, and production-build checks. Production remained read-only at
  `0032_sparkling_genesis` during that historical rehearsal. QA-018 is complete;
  the owner confirmation is retained with its date-correction note under
  `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`.
- On 2026-07-29, production advanced through authoritative migration head
  `0051_eminent_jocasta` after a retained recovery branch and zero-write
  preflight. The named immutable Conditions release passed exact manifest,
  replay, component, freshness-at-release, API, and browser checks; the
  model-free Pulse lifecycle/workspace repairs passed their retained-ledger
  validators. Cron jobs remained disabled.
- Historically, the July 29 release source `f57feca0` reached Ready as
  deployment `dpl_6BeqkVNr4uMDhrS4gxD3uERxmqdZ`, with the canonical domains
  attached and no alias error. The application, database, and critical assets
  were operational; the health contract remained honestly degraded only
  because scheduled-data freshness alerts are open. The named Conditions
  release, corrected data-error form, Explore artwork, and homepage governance
  artwork passed read-only browser checks, the deployment had no observed 5xx
  runtime log, and Vercel Cron Jobs remained disabled.
- QA-019's isolated technical run is complete. A deliberately mismatched
  release marker was detected on one protected Preview, then a one-line
  forward fix received a fresh full build and distinct Ready Preview. Both
  deployments had no production alias; the child stayed at zero active
  leases with unchanged release/data state. A synthetic non-public correction
  and bounded monitoring event were linked and resolved with no Atlas data
  change. QA-019 is checked complete under the August 9 written rehearsal
  authority. Its separate external-status record and final packet disposition
  remain in the manual queue; no subscriber notice or final disposition is claimed.
- Conditions release freezing and the Pulse lifecycle/workspace reconciliation
  are complete. ATL-020/024 also closed with the August 9 real Atlas correction
  journey, and ATL-010/DAT-036/EXP-029 closed with the named August 10 Wikidata
  release. These completed journeys are not queued again. Remaining Pulse
  drift/cycle, provider, research, and manual follow-ups retain their own scope.

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

1. **Repository enforcement — owner/platform:** the hosted CI runs are now
   observed. Main is still unprotected with no ruleset; require `verify` and
   retain the repository-setting evidence under PLT-001 when authorized.
2. **Rollback/correction disposition — owner/platform:** complete QA-019's
   separate non-notifying external-status record and final packet disposition.
   The technical rehearsal task is already complete.
3. **Cross-instance rate limiting — owner/platform:** complete the Preview
   concurrency, forwarding-header, fail-closed outage, and recovery proof.
4. **Monitoring and status providers — owner/provider:** verify protected
   source maps, safe Runtime Logs alert handling, public status configuration,
   and the non-notifying test incident named in the manual queue.
5. **Provider privacy/cost controls — owner/provider:** verify the retention
   arrangement, scoped model keys/workspaces, hard caps, and alerts.
6. **Provider recovery — owner/platform:** complete the Neon-managed PITR drill
   and decide the external-media recovery posture. The local September repair
   rehearsal does not satisfy a provider-managed PITR exercise.
7. **Program telemetry — owner:** complete PLT-029's subscription, paid-API,
   external-human-spend, and effort ledger with no unexplained spend.
8. **Visual and release gates:** close EXP-001/028 and the remaining unwaived
   P0/P1 blockers. EXP-015 and QA-018 are already owner-resolved. The map is
   deferred at Fernando's direction; this cleanup does not approve G4.

The rotated historical credential is no longer an active incident. Its
registered hash and the optional shared-history purge remain documented under
PLT-007, without being treated as a waiver or open credential.

## Decision

G4 operations readiness is **blocked**. Local contracts and rehearsals are
substantial; the September hosted release is evidenced under `plan/evidence/PLT-030/` and hosted CI under `plan/evidence/PLT-001/`. Repository
enforcement, provider controls, provider-managed recovery, the residual manual
dispositions, and remaining qualified reviews still prevent a G4 pass. There are zero waivers. Rerun the exact validators and regenerate
the G4 readiness report after each blocker closes.
