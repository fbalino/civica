# QA-018 — Release-candidate staging and smoke evidence

Status: agent-executable protocol and evidence contract complete; actual
staging run pending owner/platform authority.

`data/RELEASE-CANDIDATE-STAGING-SMOKE.md` defines the exact isolated run and
`data/release-candidate-staging-smoke.v1.json` is its fail-closed record. Twelve
checks bind the candidate commit, data/method/migration/asset identities,
isolation, job quiescence, schema/release/deployment/cache state, browser/API
smoke, protected error handling, idempotent dry run, and unchanged freshness.

The prepared migration plan is now bound to the complete authoritative ledger
after the configured `0032_sparkling_genesis` head: `0033`–`0040`, `0042`–`0048`
in exact order, with no `0041`. Each migration is machine-mapped to its actual
owning task so the shared staging apply cannot omit the later Pulse, Atlas, or
internationalization migrations or attribute their live evidence to QA-018.
The validator also compares this plan to the checked authoritative manifest
tail and fails if either drifts.

The record is `pending_external_authority`; all run outcomes and provider IDs
are empty. No Neon branch, Vercel deployment, migration, release publication,
cron invocation, production access, or owner sign-off is claimed.

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

When the authorized run occurs, Vercel tooling may handle bounded deployment
actions and identity capture, while the operator separately proves the Neon
branch, executes the single ordered database plan/apply, and retains the
task-specific post-migration validators. A successful schema fingerprint alone
does not close the migrations' owning tasks. The current concrete prerequisite
is **Advanced Options → Deployments Configuration → Required Preview** plus
**Resource must be active before deployment** for the `civica` connection to
`neon-claret-bucket`. Vercel CLI 53.2.0 does not expose those
deployment-configuration fields through `integration update`; this is an owner
action in Vercel, not a Neon sign-in. Codex will not invoke the CLI's
browser-opening SSO command.

After Vercel reports a deployment-scoped Preview environment, pull it into a
temporary `0600` file with `vercel env pull --id <deployment-id>`, then run the
guard before any migration:

```sh
node --env-file=<temporary-preview-env> --import tsx \
  scripts/inspect-neon-target.ts \
  --expected-project=ancient-art-58836757 \
  --forbidden-branch=br-dawn-frog-amrf0h6a \
  --forbidden-hostname-sha256=c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b \
  --required-migration-head=0032_sparkling_genesis
```

The temporary environment file is never checked in and is deleted immediately
after the bounded identity result is retained. A rejected result prints only a
sanitized fail-closed message.

Verification:

```sh
npm run validate:external-release-rehearsal
```
