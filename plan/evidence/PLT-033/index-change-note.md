# PLT-033 — Index change-control note: cached reader pages

Change record: `plt-033-page-cache-2026-09-29` (APR-D177).

## What changed in protected files

- `src/app/(reader)/civica-index/methodology/page.tsx` and
  `src/app/(reader)/country/[slug]/civica-data/page.tsx` declare
  `revalidate = 86400` instead of `revalidate = 0`; the Civica Data tab also
  exports an empty `generateStaticParams`.
- The Civica Data tab reads its `?section=` deep link in the browser
  (`CivicaDataSections`) instead of from `searchParams`, so its server render
  is identical for every visitor. The scroll behaviour is unchanged.
- In both pages, in `src/components/scores/ScoresAndRankings.tsx`, and in the
  identity read of the Civica Data tab, a failed database read now throws when
  a database is configured, instead of rendering an unavailable state or a
  404. `getScoresForJurisdiction` in `src/lib/db/queries-scores.ts` gains an
  opt-in `throwOnError` option that the cached callers pass; its default and
  the scores API are unchanged.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The same rows render with the same labels when the reads
succeed. The only reader-visible differences are when a page is rendered (at
most once a day, plus the daily refresh) and that a database failure now
leaves the previous good page in place instead of a degraded one.

## Release and migration

No data migration. Deploying the branch makes the pages cached; the daily
`operations.refresh-pages` job re-renders them after the day's imports.
Rollback is a code revert; no stored data depends on the change.

## Verification

`npm run validate:cache-consistency` (including
`src/lib/platform/cached-render.test.ts`, which fails if a cached page or its
components catch a database read without rethrowing), `npm test`, and a full
`npm run build`. The build output lists both pages as cached with a one-day
revalidate.
