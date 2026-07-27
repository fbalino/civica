# PLT-019 evidence — deploy and rollback rehearsal

`civica-deployment-rehearsal/v1` turns the deployment order into a checked
contract rather than relying on a build side effect. The configured database
ledger ends at `0032_sparkling_genesis`; migrations `0033` through `0039` are
therefore a single staged upgrade boundary.

The local rehearsal verifies the ordered stages, coverage, abort gates,
non-destructive reader compatibility, release/cache boundaries, and the
validation-only Vercel build configuration. It does not claim a production
migration, deployment, or provider action. The controlled provider rehearsal
is explicitly queued in `plan/MANUAL-CHECKS.md` and must follow
`data/DEPLOYMENT-REHEARSAL.md`.

## Acceptance mapping

| Requirement | Checked evidence |
| --- | --- |
| Compatible schema deployment and old-reader safety | Seven-migration source contract rejects table/column drops, truncation, deletion, and a non-null legacy `release_id`; old writers are explicitly quiesced after `0036`. |
| Jobs | Staging and production require manual Vercel Cron disablement and lease quiescence before migration; resume follows smoke checks only. |
| Caches and static assets | Cache profile and immutable versioned-release checks precede the validation-only candidate deployment. |
| Release metadata | Staging and production require checked Index predecessor publication, Pulse complete-panel checks, and exact release/source hashes before readers. |
| Smoke tests and abort points | The ordered contract has explicit staging/production stop conditions and safe reader/cron-dry-run checks. |
| Rollback and forward fix | Code rollback keeps additive schema, disables jobs manually, and limits old code to compatible reader paths; release/schema corrections are forward-only. |

## Files

- `data/DEPLOYMENT-REHEARSAL.md` — owner-operated staging, production, and
  recovery sequence.
- `src/lib/platform/deployment-rehearsal.ts` — closed sequence and migration
  compatibility contract.
- `src/lib/platform/deployment-rehearsal.test.ts` — positive and negative
  ordering, coverage, recovery, and migration fixtures.
- `scripts/validate-deployment-rehearsal.ts` — source/build/doc wiring gate.
- `source-review.md` — current Vercel and Neon operational evidence.
- `verification.json` — bounded local validation record.
