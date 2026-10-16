# APR-D180 — Index change-control note: fact source panels load on open

Change record: `perf-fact-source-panels-2026-10-15` (APR-D180).

## What changed in protected files

- `FactbookHeaderStrip.tsx` receives a compact source reference (jurisdiction,
  fact key, canonical source, canonical value, disputed flag) for the
  Population and GDP (PPP) pills instead of the complete reconciliation output.
  The pills render the same value and the same source dot.
- The source panel behind every value dot now fetches its detail (evidence
  relationship, resolver trace, every source row) from
  `/api/facts/:jurisdictionId/:factKey/panel` when a reader opens it. Pages no
  longer carry that detail.

## What did not change

No Index input selection, transform, weight, model, release, or presented
value changed. The panel text, ordering, and formatting are produced from the
same resolver output by the same formatting rules; only where they are
computed (the server, on request) changed.

## Release and migration

No schema or data migration. Rollback is a code revert.

## Verification

`npm run validate:cache-consistency`, `npm run validate:route-io-policy`,
`npm run validate:rate-limit-policy`, `npm run validate:publisher-attribution`,
`npm run validate:claims-docs`, `npm test`, TypeScript, and a browser
comparison of panel content against production for Uruguay, Japan, and
Greenland.
