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

When the authorized run occurs, Vercel tooling may handle bounded deployment
actions and identity capture, while the operator separately creates and proves
the Neon branch, executes the single ordered database plan/apply, and retains
the task-specific post-migration validators. A successful schema fingerprint
alone does not close the migrations' owning tasks.

Verification:

```sh
npm run validate:external-release-rehearsal
```
