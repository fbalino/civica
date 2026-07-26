# QA-018 — Release-candidate staging and smoke evidence

Status: authorized disposable-branch migration run in progress; Vercel Preview
deployment, remaining smoke checks, and owner sign-off are still pending.

`data/RELEASE-CANDIDATE-STAGING-SMOKE.md` defines the exact isolated run and
`data/release-candidate-staging-smoke.v1.json` is its fail-closed record. Twelve
checks bind the candidate commit, data/method/migration/asset identities,
isolation, job quiescence, schema/release/deployment/cache state, browser/API
smoke, protected error handling, idempotent dry run, and unchanged freshness.

The prepared migration plan is now bound to the complete authoritative ledger
after the configured `0032_sparkling_genesis` head: `0033`–`0040`, `0042`–`0049`
in exact order, with no `0041`. Each migration is machine-mapped to its actual
owning task so the shared staging apply cannot omit the later Pulse, Atlas, or
internationalization migrations or attribute their live evidence to QA-018.
The validator also compares this plan to the checked authoritative manifest
tail and fails if either drifts.

The current disposable branch remains truthfully recorded at `0048`; migration
`0049_curvy_shen` is now part of the required plan but is not claimed as
applied until the next bounded staging record proves it.

The canonical smoke record remains `pending_external_authority` until an exact
committed candidate is bound and the remaining checks run. Attempts 04 and 05
now retain the authorized Neon branch, migration/fingerprint results, target
isolation correction, and Pulse staging rehearsal; neither claims a Vercel
deployment, production release, production cron invocation, production
database change, or owner sign-off.

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

The existing automatic Preview integration still resolves the production
branch by default, so it is not accepted as isolation evidence. The remaining
run instead builds the exact committed candidate in a clean worktree with the
disposable branch URL injected into the build process, then deploys that
prebuilt output with a deployment-scoped `DATABASE_URL` override. This changes
neither the project's persistent Preview environment nor the production
deployment. Codex will not open an integration or Neon dashboard.

After Vercel creates the deployment, pull its exact runtime environment into a
temporary `0600` file with `vercel env pull --id <deployment-id>`, then run the
guard before accepting any smoke result:

```sh
node --env-file=<temporary-preview-env> --import tsx \
  scripts/inspect-neon-target.ts \
  --expected-project=ancient-art-58836757 \
  --expected-branch=br-bitter-fire-amcx8asi \
  --expected-hostname-sha256=a5fb8fbdb1d9d993f39c19dc0e8e7a41c53fdf32f7fc1948b137db8f6aa71761 \
  --forbidden-branch=br-dawn-frog-amrf0h6a \
  --forbidden-hostname-sha256=c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b \
  --required-migration-head=0048_entity_name_forms
```

The temporary environment and deployment-scoped secret are never printed or
checked in and are deleted after bounded evidence is retained. A rejected
result prints only a sanitized fail-closed message.

Verification:

```sh
npm run validate:external-release-rehearsal
```
