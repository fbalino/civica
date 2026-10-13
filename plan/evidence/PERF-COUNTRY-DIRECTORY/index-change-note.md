# Index change-control note: one shared country list

Change record: `perf-country-directory-2026-10-12`.

## What changed in protected files

- `src/app/(reader)/country/[slug]/civica-data/page.tsx` no longer reads the
  full jurisdiction list (`getFactbookCountryOptions`) to feed the
  "Jump to country…" search. The search now reads the one shared,
  content-addressed jurisdiction directory asset
  (`public/data/jurisdiction-directory.v1-<hash>.json`, derived from the
  checked `jurisdiction-directory/v1` artifact) the first time a reader uses
  it, so the list is no longer serialized into the page's HTML or React
  Server Component payload.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The Index panel, rankings, and every rendered score are
byte-for-byte the same. The jump search offers the same 253 jurisdictions
with the same names, flags, status labels, and capitals.

## Release and migration

No data migration. The asset ships with the deploy. Rollback is a code
revert; no stored data depends on the change.

## Verification

`npx tsc --noEmit`, `npm test`, `npm run validate:jurisdiction-directory`,
`npm run validate:cache-consistency`, `npm run validate:design-tokens`,
`npm run validate:claims-docs`, and a local browser check of the header,
footer, country jump, and 404 searches.
