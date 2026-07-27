# QA-018 — Release-candidate staging and smoke evidence

Status: current `0051` technical run complete; Fernando's dated approval or
rejection remains pending. No owner sign-off is claimed.

`data/RELEASE-CANDIDATE-STAGING-SMOKE.md` defines the exact isolated run and
`data/release-candidate-staging-smoke.v1.json` is its fail-closed record. Twelve
checks bind the candidate commit, data/method/migration/asset identities,
isolation, job quiescence, schema/release/deployment/cache state, browser/API
smoke, protected error handling, idempotent dry run, and unchanged freshness.

The retained migration plans and replay records remain historical evidence for
the exact candidates that produced them; they are not rewritten when the
authoritative ledger advances. Attempt 07 separately proves the exact required
`0033`–`0040`, `0042`–`0051` sequence, with no `0041`, 51 matching ledger
entries, and the checked public-schema fingerprint. Each migration remains
machine-mapped to its actual owning task; one shared schema pass is not
substituted for each task's product validation.

The canonical smoke record is now
`run_complete_pending_owner_signoff`. It binds candidate `61351a43`, the
disposable child, exact prebuilt Preview, Conditions/Index/Pulse pointers,
737-file static manifest, twelve passing checks, responsive browser evidence,
and unchanged source freshness. Production remained at
`0032_sparkling_genesis` before and after the run. No production release,
production cron invocation, production database change, promotion, or owner
sign-off is claimed.

After the bounded evidence and readiness reports were committed on 2026-07-26,
the pinned Neon CLI deleted only unprotected child
`br-bitter-fire-amcx8asi`. A post-delete branch listing confirmed that child
absent and production branch `br-dawn-frog-amrf0h6a` (`main`) still present.
The cleanup does not supply the new isolated run required for the current
candidate.

## Recorded staging attempts

- [`attempt-01-2026-07-25.md`](attempt-01-2026-07-25.md) records the first
  disposable-branch run. It stopped at migration `0036` after exposing a SQL
  statement-splitting defect, preserved the transactional rollback, deleted
  the partial branch, and made no production or deployment change.
- [`attempt-02-2026-07-25.md`](attempt-02-2026-07-25.md) records the second
  disposable-branch run. It stopped at the same migration after exposing a
  frozen-vintage/backfill guard collision, preserved the transactional
  rollback, invalidated and deleted the child-only credential, and left
  production untouched.
- [`attempt-03-vercel-cli-isolation-2026-07-26.md`](attempt-03-vercel-cli-isolation-2026-07-26.md)
  records the accepted Vercel CLI evidence against candidate `8cf26c97`. The
  read-only deployment probe proved that Preview currently resolves to the
  production Neon branch, so the run aborted before any migration. It also
  records the abandoned browser sign-in detour truthfully: no Neon access was
  obtained and no browser-derived evidence was accepted. Its bounded machine
  record is
  [`vercel-cli-isolation-probe.v1.json`](vercel-cli-isolation-probe.v1.json).
  Vercel-managed automated Preview branching must be enabled on the existing
  project/resource connection before another run.
- [`attempt-04-schema-fingerprint-2026-07-26.md`](attempt-04-schema-fingerprint-2026-07-26.md)
  records the authorized CLI-created disposable branch, the exact `0032` →
  `0048` apply, the stale checked-fingerprint defect it exposed, the bounded
  catalog correction, and matching production-shaped and fresh PostgreSQL 17
  replays. Its machine record is
  [`schema-fingerprint-replay.v1.json`](schema-fingerprint-replay.v1.json).
  Production remained untouched and the remaining Vercel/release/browser/API
  smoke checks are not yet claimed.
- [`attempt-05-target-isolation-and-pulse-2026-07-26.md`](attempt-05-target-isolation-and-pulse-2026-07-26.md)
  records the environment-precedence defect, the fail-closed script inventory,
  the corrected model-free Pulse successor run, and the production-only
  read-only PUL-040 refresh. The bounded Pulse record is
  [`../PUL-027/qa-018-staging-rehearsal-2026-07-26.json`](../PUL-027/qa-018-staging-rehearsal-2026-07-26.json).
- [`attempt-06-isolated-preview-smoke-2026-07-26.md`](attempt-06-isolated-preview-smoke-2026-07-26.md)
  records the exact prebuilt Preview, runtime target attestation, API/cache/
  protected-route/idempotent-dry-run checks, responsive browser run, and the
  owner-signoff boundary. Its bounded records are
  [`run-06-preview-smoke.v1.json`](run-06-preview-smoke.v1.json),
  [`browser-smoke.v1.json`](browser-smoke.v1.json), and
  [`staging-static-assets.v1.json`](staging-static-assets.v1.json).
- [`attempt-07-conditions-release-2026-07-27.md`](attempt-07-conditions-release-2026-07-27.md)
  records the fresh child migration through `0051`, captured-input Conditions
  release and replay/refusal gates, ordered Index publication, deterministic
  model-free Pulse successor, exact prebuilt Preview, API/cache/protected-route
  and cron dry-run checks, and responsive browser matrix. Its current machine
  records are
  [`run-07-preview-smoke.v1.json`](run-07-preview-smoke.v1.json),
  [`staging-static-assets-attempt-07-0051.v1.json`](staging-static-assets-attempt-07-0051.v1.json),
  and
  [`../ATL-016/browser-evidence-attempt-07-0051.v1.json`](../ATL-016/browser-evidence-attempt-07-0051.v1.json).

The existing automatic Preview integration still resolves the production
branch by default, so it is not accepted as isolation evidence. The remaining
run instead builds the exact committed candidate in a clean worktree with the
disposable branch URL injected into the build process, then deploys that
prebuilt output with a deployment-scoped `DATABASE_URL` override. This changes
neither the project's persistent Preview environment nor the production
deployment. Codex will not open an integration or Neon dashboard.

The following retained command documents the target guard used for attempt 07:

```sh
node --env-file=<temporary-preview-env> --import tsx \
  scripts/inspect-neon-target.ts \
  --expected-project=ancient-art-58836757 \
  --expected-branch=br-gentle-paper-amsh6g7c \
  --expected-hostname-sha256=927dbb0aec671e18fc4b632a8e466b1e312bee6f35c1190c11084d5c5266bb79 \
  --forbidden-branch=br-dawn-frog-amrf0h6a \
  --forbidden-hostname-sha256=c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b \
  --required-migration-head=0051_eminent_jocasta
```

When Vercel has already left `INITIALIZING`, the checked protocol permits only
the exact-Preview runtime attestation described in
`data/RELEASE-CANDIDATE-STAGING-SMOKE.md`. Attempt 06 retained the sanitized
`BUILDING` and `READY` rejections, then matched the deployment-scoped child
input guard to a child-only Conditions release and head/pointer evidence
observed from the exact Preview host. The temporary environment, automation
token, and deployment-scoped secret were never printed or checked in.

For the current `0051` candidate, the machine contract makes the two proof
modes exclusive. The preferred mode retains one sanitized successful
`INITIALIZING` pull. Attempt 07 truthfully uses the fallback: one sanitized
`READY` state-window rejection plus the bounded failure code, with no provider
error body retained. The runtime attestation binds the candidate commit,
deployment ID, exact Preview URL and host, target `preview`, disposable-child
project/branch/endpoint/hostname hash, forbidden production branch/hostname
hash, head `0051_eminent_jocasta`, and the Conditions release/method/manifest
pointer.

Verification:

```sh
npm run validate:external-release-rehearsal
```
