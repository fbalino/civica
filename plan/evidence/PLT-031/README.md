# PLT-031 — reliable routine data updates

Owner authorization: 2026-09-17, repair data updating so the owner does not have to check continuously, investigate service-email noise, and proceed with the engineering work. This does not authorize academic validation claims or enable paid classification.

## Confirmed findings

- The cabinet import requires `CIVICA_ATLAS_RELEASE_ID`, which was absent in Production. It checked this only after fetching upstream data.
- Canada, Germany, and France bill jobs failed on all 30 recent daily runs; the cabinet job failed on 29 of 30. Every failed execution had one attempt. The three-attempt safety cap did not schedule another delivery.
- The pipeline alert monitor returned failure for successfully detected alerts, and then included its own failed run as an alert input.
- Canada returned a current JSON schema that no longer matched the adapter fields. An initial HEAD/redirect check was insufficient: the actual GET returned 185 bill rows. Germany used an expired temporary key. France's Senate source supplied official HTTP URLs that the HTTPS-only writer correctly rejected; the adapter now canonicalizes only verified Senate hosts to HTTPS. A publisher or configuration failure must not be converted into a successful or fresh import.

## Delivery controls

Routine npm version-update PRs are capped at two; GitHub Actions version updates are grouped and capped at one. Both have a seven-day cooldown. Dependabot security updates are outside that cooldown. Existing weekly checks and npm minor/patch grouping remain.

Civica project Vercel Pull Request Comments were changed from on to off on 2026-09-17. Commit Comments were already off. Commit Status, deployment-status events, and repository-dispatch events remain on. After the owner chose Codex to handle operational failures, the personal Vercel team Deployment Failures email channel was disabled; its web channel remains enabled. Billing, domain, and security-related notices were not changed. GitHub Actions failure notifications were moved from email-only to on-GitHub-only, retaining the failed-workflows filter. Dependabot vulnerability alerts and security notifications were unchanged. No mailbox messages were modified. These later personal-channel changes are recorded separately from the initial delivery-controls snapshot.

The recent Civica notification burst included eight Dependabot closure comments, four Vercel pull-request status comments, five CI failure messages, and four deployment-failure messages from superseded attempts. The replacement production deployment was Ready. Private mail identifiers, addresses, contents, and unsubscribe tokens are intentionally not retained here.

The default branch now requires a pull request, passing `verify` from GitHub Actions and `Vercel`, current-base checks, resolved review conversations, and squash merge. Force pushes and branch deletion are blocked. There are zero required human approvals and no bypass actors. The repository already had auto-merge and automatic head-branch deletion enabled. Ruleset ID: `23623964`.

## Merged repair

- Cabinet configuration is validated before source requests or domain database reads, including dry runs. The configured routine revision identity is distinct from the frozen July release and the capital repair.
- Canada consumes the current official schema and discovers the bounded current parliamentary session. France normalizes only official Senate URLs. Germany reads its publisher key from the environment, follows supported cursor pagination, and classifies source failures safely.
- Current live-source dry runs through the normal writer validation mapped 100 Canadian, 100 French, and 77 German records. They wrote no domain rows, summary cache, or freshness timestamps. The shared bills dry-run path now also skips paid summary generation even when a model key is configured; normal apply behavior is unchanged. An isolated writer rehearsal and deployed execution checks are separate evidence. The rehearsal restored the new backup into a separate local database: the real atomic writer inserted 141 and updated 136 records; repeating the exact captured inputs left all 277 unchanged with zero writes or source stamps. Captured records had valid HTTPS URLs and source/jurisdiction linkage, with no orphan or duplicate keys. The no-paid model seam is explicit: production cache-first behavior would replace 73 existing summaries and has 56 cache misses; the preservation drill does not establish paid model outputs. Historical Senate HTTP URLs outside the current batch remain existing data debt.
- The existing 15-minute health job dispatches at most four distinct recoverable jobs from retained scheduled executions in the last 48 hours. Transient retries use 15-minute then 60-minute backoff and the existing three-attempt ceiling. Original execution identity, schedule time, job lease, and fencing survive redelivery. Unrecorded missed slots are not invented or backfilled.
- Authentication, deterministic configuration/schema failures, paid classification, unsupported Vercel clustering, monitor recursion, and jobs requiring the platform's full 800-second budget are excluded from automatic recovery. The dispatcher has a 650-second bound so its own ledger can finish.
- Health findings return successful monitor execution with separate health state. The pipeline monitor excludes itself from alert inputs and retains its original PLT-017 contract: open findings return HTTP 503 with a durable `pipeline_alert_*` transition. That record describes reported pipeline health; it must not be diagnosed as a new failed ingestion or recursively retried. Transitions suppress unchanged incidents, retain recovery state, and keep the existing reminder cadence (24 hours for health, 72 hours for pipeline alerts). Advisory reconciliation findings return successful completion with `healthOk: false`; genuine verification failure remains failure.
- Independent review covered retry authorization, canonical dispatch, retained schedule inputs, leases, backoff, alert continuity, and bounded timeouts. The focused re-review passed 17 tests; the recovery lane passed all 287 cron-safety tests before integration.

## Production configuration and recovery point

On 2026-09-17, Production was given `CIVICA_ATLAS_RELEASE_ID` and Germany's current publisher-provided API key. The publisher's public key is valid through May 2027 and still needs a future renewal or replacement; no key material is retained in Git. These settings apply to subsequent deployments, not already-running deployment snapshots.

A fresh read-only PostgreSQL snapshot completed at 2026-09-17T20:51:46.410Z: 194,848,687 bytes, SHA-256 `147234753464d95ef9ae7b3be67103d5032fecd1470a412a8f2b472f4e1e7804`. The private dump is outside Git. It is a recovery point, not proof that the repaired imports ran.

## Deployed verification — 2026-09-17

PR #35 merged the repair. Its first production build exposed two negative tests
that inherited the newly configured valid Atlas release identity. PR #36 isolated
those fixtures; the full configured-environment unit suite passed 2,267 tests
with three skips, and every required hosted check passed. No runtime guard,
production setting, or release gate was removed.

Commit `e99cecd0f66550634d3281f2ac8b7dd9b52a3856` reached Ready as
`dpl_H56r26mdRqRU1L8MbzhKP1RN4ooX`, with the canonical domain resolving to
that exact deployment. Real deployed dry runs succeeded for Canada (100 rows),
Germany (77), France (100), and cabinet shard 16 (nine requested pages, seven
usable country plans, two expected missing pages, 696 projected rows).
No bill or cabinet-domain fingerprint changed, no source freshness moved, and
no paid summary was generated. The cabinet response's `totalRowsWritten` is a
projection in dry-run mode, not an observed production write.

An exact Canadian replay returned `200 duplicate_suppressed` with one retained
successful attempt. The health monitor returned HTTP 200 with the new recovery
summary and zero eligible dispatches; no fault was injected to manufacture a
retry. Reconciliation returned HTTP 200 with 13 passes, one advisory warning,
zero failures, and truthful `healthOk: false`. Exact bounded evidence is in
`production-verification-2026-09-17.json`.

The probes used authenticated GET requests with stable `Idempotency-Key`
headers. The initial empty POST requests were rejected as `body_not_allowed`
before execution by the deployed no-body guard; the documented GET path works.
Normal scheduled GET delivery is unaffected. Use that GET path for Codex's
manual checks until the separate POST hosting boundary is revisited.

## Current status and limits

PLT-031 remains open for the first ordinary post-repair scheduled applications:
cabinet at September 18 01:00 UTC, Canada 04:00, Germany 05:00, and France 05:30.
The dry runs establish deployed fetching/planning and no-write behavior; they
do not establish a normal data application or advance source freshness. Codex
owns this follow-up; the owner does not need to check each run.

The application retains structured Runtime Logs and execution records. On
2026-09-17 the owner chose Codex to investigate instead of receiving repeated
sync-failure emails. The active hourly local heartbeat inspects production,
attempts routine repairs within this authorized scope, and escalates only when
owner input is needed. It requires the local host to be available. No email or
public status-page publication was added. Intentionally disabled research
stages, the failing GDELT retrieval, unobserved historical schedule slots, and
excluded long-running jobs remain separately visible. PLT-025 and research
gates remain separate.

## Official configuration references (checked 2026-09-17)

- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cooldown
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups
- https://vercel.com/docs/git/vercel-for-github
