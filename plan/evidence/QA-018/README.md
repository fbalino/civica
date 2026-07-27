# QA-018 — Release-candidate staging and smoke evidence

Status: retained historical `0050` technical-run evidence. The current
integrated candidate now requires a new isolated run through `0051`; no new
provider result or owner sign-off is claimed.

`data/RELEASE-CANDIDATE-STAGING-SMOKE.md` defines the exact isolated run and
`data/release-candidate-staging-smoke.v1.json` is its fail-closed record. Twelve
checks bind the candidate commit, data/method/migration/asset identities,
isolation, job quiescence, schema/release/deployment/cache state, browser/API
smoke, protected error handling, idempotent dry run, and unchanged freshness.

The retained migration plans and replay records are historical evidence for
the exact candidates that produced them; they are not rewritten when the
authoritative ledger advances. The now-deleted disposable child proves head
`0050_index_release_header_contract`, 50 matching ledger entries, and the
checked public-schema fingerprint. The current pending record separately binds
the required `0033`–`0040`, `0042`–`0051` sequence, with no `0041`. A new exact
`0051` zero-write plan and rehearsal artifact will be created during the new
isolated run. Each migration remains machine-mapped to its actual owning task;
one shared schema pass is not substituted for each task's product validation.

The canonical smoke record has returned to `pending_external_authority` for the
new exact candidate. The earlier exact candidate, disposable child, prebuilt
Preview, release/method pointers, static manifest, twelve checks, responsive
browser evidence, and unchanged freshness remain retained here without
credentials. They are not relabeled as evidence for `0051`. No production
release, production cron invocation, production database change, promotion, or
owner sign-off is claimed.

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

The existing automatic Preview integration still resolves the production
branch by default, so it is not accepted as isolation evidence. The remaining
run instead builds the exact committed candidate in a clean worktree with the
disposable branch URL injected into the build process, then deploys that
prebuilt output with a deployment-scoped `DATABASE_URL` override. This changes
neither the project's persistent Preview environment nor the production
deployment. Codex will not open an integration or Neon dashboard.

The following retained command documents the preferred proof used for the
historical `0050` candidate. The new isolated run must substitute its newly
created child identity and require `0051_eminent_jocasta`; this example is not
current-candidate authorization:

```sh
node --env-file=<temporary-preview-env> --import tsx \
  scripts/inspect-neon-target.ts \
  --expected-project=ancient-art-58836757 \
  --expected-branch=br-bitter-fire-amcx8asi \
  --expected-hostname-sha256=a5fb8fbdb1d9d993f39c19dc0e8e7a41c53fdf32f7fc1948b137db8f6aa71761 \
  --forbidden-branch=br-dawn-frog-amrf0h6a \
  --forbidden-hostname-sha256=c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b \
  --required-migration-head=0050_index_release_header_contract
```

When Vercel has already left `INITIALIZING`, the checked protocol permits only
the exact-Preview runtime attestation described in
`data/RELEASE-CANDIDATE-STAGING-SMOKE.md`. Attempt 06 retained the sanitized
`BUILDING` and `READY` rejections, then matched the deployment-scoped child
input guard to a child-only Conditions release and head/pointer evidence
observed from the exact Preview host. The temporary environment, automation
token, and deployment-scoped secret were never printed or checked in.

For the current `0051` candidate, the machine contract now makes the two proof
modes exclusive. The preferred mode retains one sanitized successful
`INITIALIZING` pull. The fallback retains only sanitized `BUILDING` and/or
`READY` state-window rejections plus the bounded failure code; raw provider
errors are prohibited. Either mode must bind the current candidate commit,
deployment ID, exact Preview URL and host, target `preview`, the disposable
child project/branch/endpoint/hostname hash, the forbidden production
branch/hostname hash, head `0051_eminent_jocasta`, and the Conditions
release/method/manifest pointer. The canonical record remains pending and
contains no invented provider result.

Verification:

```sh
npm run validate:external-release-rehearsal
```
