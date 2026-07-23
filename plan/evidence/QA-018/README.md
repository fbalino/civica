# QA-018 — Release-candidate staging and smoke evidence

Status: agent-executable protocol and evidence contract complete; actual
staging run pending owner/platform authority.

`data/RELEASE-CANDIDATE-STAGING-SMOKE.md` defines the exact isolated run and
`data/release-candidate-staging-smoke.v1.json` is its fail-closed record. Twelve
checks bind the candidate commit, data/method/migration/asset identities,
isolation, job quiescence, schema/release/deployment/cache state, browser/API
smoke, protected error handling, idempotent dry run, and unchanged freshness.

The record is `pending_external_authority`; all run outcomes and provider IDs
are empty. No Neon branch, Vercel deployment, migration, release publication,
cron invocation, production access, or owner sign-off is claimed.

Verification:

```sh
npm run validate:external-release-rehearsal
```
