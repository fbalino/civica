# Current handoff — Civica

**Updated:** 2026-08-17 (subscription-runtime wave; $0 locks live)
**Current objective:** merge the pulse-v2.16-beta subscription-runtime wave,
then run the first deployed compliant cycle and record the PUL-040 start.

## Verified state

- Active branch: `main` (local, ahead with the uncommitted wave). Production
  runs main + hotfix PR #21.
- **$0 enforcement is live and verified in production twice over:** the
  owner removed the three classifier API keys and redeployed
  (`provider_key_absent` probe), and the hotfixed classify route refuses any
  paid transport (`paid_transport_locked` probe). The Vercel cron feature
  toggle is enabled again; scheduled ingest/cluster/score are model-free.
- The wave in this working tree implements the adopted
  `plan/pulse-subscription-runtime-resolution-v1.md`: restored ingestion
  (partial-availability publication, IPU JSON:API parser, always-finalizing
  runs, 31 stuck runs repaired), the four-voter subscription CLI transport
  (live-smoke-tested), runtime method `pulse-v2.16-beta` with regenerated
  contract, `pulse-validation-protocol/v2` (v1 preserved + hash-pinned), a
  fresh dated source-coverage audit, and the Mac daily runner + one-click
  launchd installer (`scripts/pulse/`).
- 302/302 pulse tests, TypeScript, and every pulse validator pass locally.
  The aggregate claims gate currently fails on one non-pulse unit test —
  under diagnosis; must be green before the wave merges.
- PUL-024 and PUL-040 stay unchecked until after deploy: drift baseline over
  frozen-method observations + one scheduled monitoring outcome (PUL-024);
  first compliant deployed cycle + non-backdated start record (PUL-040).

## Next actions

1. Fix the one failing unit test; rerun `validate:claims-docs` to green.
2. Commit the wave, PR to main, merge; Vercel deploys pulse-v2.16-beta.
3. Owner runs `scripts/pulse/install-pulse-runner.command` (guided; installs
   the 09:30 daily launchd job) and keeps the Mac on daily.
4. Run the first compliant cycle (runner), then record the PUL-040 start per
   `plan/evidence/PUL-040/README.md` — never backdated.
5. Capture the drift baseline once enough frozen-method observations exist;
   after a scheduled monitoring outcome records, complete PUL-024 and
   PUL-040 checklist bookkeeping + readiness regeneration.

## Boundaries

- No paid classifier transport, ever, without new written owner authority;
  the $0 cap is absolute. Do not weaken the route lock or PUL-036.
- Never rewrite `data/research/pulse-validation-protocol-v1.json` or any
  retained v2.15 artifacts. Rewrite this handoff at the next milestone.
