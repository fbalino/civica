# APR-D179 — Index change-control note: pages rebuilt nightly when their data changed

Change record: `apr-d179-changed-page-rebuild-2026-10-12` (APR-D179, amending
APR-D178).

## What changed in protected files

- Every cached database-backed page, including the protected Index pages,
  declares `revalidate = 2592000` (30 days) instead of `revalidate = 259200`.
  The value is only a backstop. `operations.refresh-pages` now runs nightly
  and rebuilds only pages whose rendered data changed, so an unchanged page is
  not rebuilt by the job; a 72-hour backstop would let crawler visits rebuild
  it. The cache-consistency constant and its tests follow.
- `operations.refresh-pages` runs nightly at 07:00 UTC (`0 7 * * *`) instead
  of every other day. It rebuilds a country's tabs only when that country's
  content fingerprint, stored in the new `page_cache_fingerprints` table,
  changed, and rebuilds the non-country pages (including the Index pages)
  every night.
- The Civica Data tab shows, per source, the date Civica last recorded the
  country's own rows from that source instead of the source-wide
  `sources.last_sync_at`.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The Rankings section renders the same rows with the same
publisher edition and retrieval time. Only rebuild timing and the
source-strip dates beside non-Index sections change.

## Release and migration

Additive migration `0052_page_cache_fingerprints` creates one empty internal
table. The first run after deploy finds no stored fingerprints and rebuilds
every page once. Rollback is a code revert; the table can then be dropped.

## Verification

`npm run validate:cache-consistency`, `npm run validate:cron-safety`,
`npm run validate:publisher-attribution`, `npm run validate:claims-docs`,
`npm test`, and TypeScript.
