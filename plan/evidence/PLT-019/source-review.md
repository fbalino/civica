# PLT-019 platform source review

Reviewed 2026-07-16 using the current official pages listed below.

## Vercel Instant Rollback

[Vercel's Instant Rollback documentation](https://vercel.com/docs/instant-rollback)
states that rollback restores a previous production deployment, does not update
project environment variables, and requires attention to external database/CMS
state. It also says automatic production-domain assignment is disabled after a
rollback until a deployment is promoted. The runbook therefore treats rollback
as a code-routing operation only: it retains the additive Neon schema and
requires an explicit later promotion.

## Vercel Cron Jobs

[Vercel's Cron Jobs documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
states that deployments do not interrupt already running jobs, cron delivery can
be missed or duplicated, and failed invocations are not automatically retried.
It also warns that active Cron Jobs may continue after an Instant Rollback.
This changes the rehearsal materially: operators manually disable jobs and wait
for Civica's lease/retry boundary before migration and keep them disabled until
post-deployment smoke checks pass.

## Neon branches

[Neon's branch documentation](https://neon.com/docs/manage/branches) describes
child branches as copy-on-write clones whose changes do not affect their parent.
It supports branches made from current data, schema-only branches, and expiry.
The rehearsal uses a short-lived current-data child branch with a separate
Vercel environment to prove the production-shaped upgrade without assigning
production credentials to a preview/build.
