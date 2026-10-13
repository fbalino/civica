# APR-D178 — Index change-control note: pages rebuilt every other day

Change record: `apr-d178-page-rebuild-2026-10-12` (APR-D178, amending APR-D177).

## What changed in protected files

- Every cached database-backed page, including the protected Index pages,
  declares `revalidate = 259200` (72 hours) instead of `revalidate = 86400`.
  The value is only a backstop; pages are rebuilt by the scheduled job.
- `operations.refresh-pages` runs every other day at 06:00 UTC
  (`0 6 */2 * *`, 03:00 in Uruguay) instead of daily at 10:00 UTC. Its
  comments and the cache-consistency constant follow.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The same rows render with the same labels. The only
reader-visible difference is when a page is rebuilt: every other day at
06:00 UTC instead of daily at 10:00 UTC. Data that lands after 06:00 UTC
(the 06:30 cache refresh and Pulse) reaches pages at the next rebuild.

## Release and migration

No data migration. The new schedule takes effect on deploy. Rollback is a
code revert; no stored data depends on the change.

## Verification

`npm run validate:cache-consistency`, `npm run validate:cron-safety`,
`npm test`, `npm run validate:claims-docs`, and TypeScript.
