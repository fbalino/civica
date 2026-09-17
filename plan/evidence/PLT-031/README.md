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

## Repair candidate

- Cabinet configuration is validated before source requests or domain database reads, including dry runs. The configured routine revision identity is distinct from the frozen July release and the capital repair.
- Canada consumes the current official schema and discovers the bounded current parliamentary session. France normalizes only official Senate URLs. Germany reads its publisher key from the environment, follows supported cursor pagination, and classifies source failures safely.
- Current live-source dry runs through the normal writer validation mapped 100 Canadian, 100 French, and 77 German records. They wrote no domain rows, summary cache, or freshness timestamps. The shared bills dry-run path now also skips paid summary generation even when a model key is configured; normal apply behavior is unchanged. An isolated writer rehearsal and deployed execution checks are separate evidence. The rehearsal restored the new backup into a separate local database: the real atomic writer inserted 141 and updated 136 records; repeating the exact captured inputs left all 277 unchanged with zero writes or source stamps. Captured records had valid HTTPS URLs and source/jurisdiction linkage, with no orphan or duplicate keys. The no-paid model seam is explicit: production cache-first behavior would replace 73 existing summaries and has 56 cache misses; the preservation drill does not establish paid model outputs. Historical Senate HTTP URLs outside the current batch remain existing data debt.
- The existing 15-minute health job dispatches at most four distinct recoverable jobs from retained scheduled executions in the last 48 hours. Transient retries use 15-minute then 60-minute backoff and the existing three-attempt ceiling. Original execution identity, schedule time, job lease, and fencing survive redelivery. Unrecorded missed slots are not invented or backfilled.
- Authentication, deterministic configuration/schema failures, paid classification, unsupported Vercel clustering, monitor recursion, and jobs requiring the platform's full 800-second budget are excluded from automatic recovery. The dispatcher has a 650-second bound so its own ledger can finish.
- Health and pipeline findings persist without making the monitor itself a failed data pipeline. Durable alert transitions suppress unchanged incidents, remind after 24 hours, and retain recovery state. Advisory reconciliation findings return successful completion with `healthOk: false`; genuine verification failure remains failure.
- Independent review covered retry authorization, canonical dispatch, retained schedule inputs, leases, backoff, alert continuity, and bounded timeouts. The focused re-review passed 17 tests; the recovery lane passed all 287 cron-safety tests before integration.

## Production configuration and recovery point

On 2026-09-17, Production was given `CIVICA_ATLAS_RELEASE_ID` and Germany's current publisher-provided API key. The publisher's public key is valid through May 2027 and still needs a future renewal or replacement; no key material is retained in Git. These settings apply to subsequent deployments, not already-running deployment snapshots.

A fresh read-only PostgreSQL snapshot completed at 2026-09-17T20:51:46.410Z: 194,848,687 bytes, SHA-256 `147234753464d95ef9ae7b3be67103d5032fecd1470a412a8f2b472f4e1e7804`. The private dump is outside Git. It is a recovery point, not proof that the repaired imports ran.

## Current status and limits

Open until the integrated candidate is deployed and current execution evidence is captured. Configuration presence and local tests alone do not establish production recovery. The application retains structured Runtime Logs and execution records. On 2026-09-17 the owner explicitly chose Codex to investigate instead of sending sync failures to the owner. An hourly local Codex heartbeat now inspects production state, attempts routine repairs within this authorized scope, and escalates only when owner input is needed. It depends on the local host being available; it is not an external continuous alert drain or automatic Incident.io publication. No email delivery was added. Intentionally disabled research stages, the failing GDELT retrieval, missed schedule slots, and excluded long-running jobs remain separately visible. PLT-025 and research gates remain separate.

## Official configuration references (checked 2026-09-17)

- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cooldown
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups
- https://vercel.com/docs/git/vercel-for-github
