# Deployment and rollback rehearsal

**Contract:** `civica-deployment-rehearsal/v1`
**Owner:** Fernando Baliño
**Last reviewed:** 2026-07-18

This is the mandatory order for schema, data release, application deployment,
and recovery. It closes the gap between the configured production database,
whose authoritative ledger ends at `0032_sparkling_genesis`, and the additive
PLT/ATL/Pulse/Explore migrations `0033`–`0040` and `0042`–`0049`. There is no
authoritative `0041` migration.

## Non-negotiable boundaries

- A Vercel build never runs `db:migrate`. Builds can execute for previews and
  must validate the checked tree only. Migration is an explicit owner-operated
  pre-deploy step against one named target database.
- Staging uses a disposable **Neon child branch** made from a recorded current
  production point, with a separate Vercel environment and expiration. It must
  never receive the production `DATABASE_URL`.
- Disable Vercel Cron Jobs manually before a staging or production migration.
  A deployment does not interrupt a running invocation; Vercel also documents
  that active cron jobs may continue after an Instant Rollback. Civica's lease
  ledger is an additional safeguard, not permission to leave writers running.
- All deployed cache behavior comes from `civica-cache-consistency/v1`:
  mutable reads are `no-store`, checked artifacts must revalidate, and frozen
  releases use a new versioned URL instead of a purge or overwrite.
- The staged migrations retain existing reader columns and do not delete rows,
  tables, or columns. The PLT-014 release migration changes named-score writer
  rules, so an old deployment is read-compatible only. Do not re-enable old
  writers after a code rollback; ship a forward fix first.

## Staging rehearsal

1. Record the candidate commit, immutable release IDs and URLs, source-map
   release identity, static artifact hashes, current production deployment URL,
   and the proposed migration hashes. Run `npm run validate:deployment-rehearsal`.
   Abort if any identity is ambiguous or a frozen release would be overwritten.
2. Create a short-lived Neon child branch from the recorded production state.
   Set only the staging project's database connection to that branch. Disable
   all staging Cron Jobs in Vercel, then verify no old staging lease is active.
   Abort if either isolation or job quiescence cannot be shown.
3. Against the staging branch, run `npm run db:plan -- --live`. It must be a
   zero-write plan for the expected authoritative migrations. Then run
   `npm run db:migrate`, `npm run validate:authoritative-migrations:live`, and
   the relevant live validators. Abort on a migration hash, ledger, or public
   fingerprint mismatch; do not deploy the app to diagnose it.
4. Verify release data before readers: validate source-input and release
   artifacts, run the explicit Index `stage:ci-release`, `check:ci-release`,
   and `publish:ci-release` modes in declared predecessor order, and prove the
   Pulse pointer selects one complete, successful score run. Abort if a
   semantic hash, pointer, provenance, or release-quality check fails.
5. Deploy the candidate to the isolated staging project. Its Vercel build is
   validation-only. Check that checked artifacts have their expected
   revalidation headers, frozen releases retain their versioned immutable URLs,
   and live API data remains non-cacheable.
6. Perform browser and request-safe smoke checks for an Atlas country read, an
   Index release read, a Pulse published-score read, a protected error path,
   and one idempotent cron dry run. Verify the dry run did not advance source
   freshness. Keep staging jobs disabled. Any failure is an abort point.
7. Record only branch/deployment IDs, timestamps, migration IDs, release IDs,
   cache-header results, and bounded pass/fail outcomes. Delete the disposable
   Neon branch when the evidence is recorded.

## Production promotion

1. Repeat the candidate record and identify the rollback-eligible production
   deployment. Manually disable production Cron Jobs and wait for each active
   job lease to finish or expire safely. Do not begin while a writer is active.
2. Run the same zero-write plan and explicit `npm run db:migrate` against the
   production target. Then verify the authoritative ledger and complete schema
   fingerprint. Abort before release publication or app promotion on any drift.
3. Publish only the staged and semantically verified release metadata/pointers.
   A data correction is a successor release with a new versioned URL, never an
   edit to a frozen vintage or a pointer deletion.
4. Promote the rehearsed candidate. Confirm release identity, static assets,
   cache behavior, and reader smoke checks before manually re-enabling Cron
   Jobs. The first safe dry run must use the existing idempotency contract.

## Recovery and rollback

For a code incident, manually disable Cron Jobs first. Use Vercel **Instant
Rollback** only to return traffic to a known compatible production deployment;
it does not roll back Neon data, environment configuration, or external state.
After a rollback Vercel disables automatic production-domain assignment, so a
subsequent known-good deployment must be explicitly promoted to resume normal
assignment.

Keep the additive database schema in place. The prior code may serve its
existing reader paths, but legacy writers must remain disabled after `0036`.
Resolve a schema or data error with a reviewed forward fix or a new successor
release. A restore is an isolated provider-managed recovery operation under
DAT-021, not an implicit reverse migration, and it must not delete retained
evidence.

## Current official references

Reviewed 2026-07-16:

- [Vercel — Performing an Instant Rollback on a Deployment](https://vercel.com/docs/instant-rollback)
- [Vercel — Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Neon — Manage branches](https://neon.com/docs/manage/branches)
