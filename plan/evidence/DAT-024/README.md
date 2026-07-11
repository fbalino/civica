# DAT-024 — As-published snapshot exports

Completed 2026-07-11.

## Outcome

- `civica-atlas-export/v2` reads `country_fact_vintages` under the exact label `Civica Atlas Reconciled v0.2-beta — vintage 2026-Q1`.
- Citation-defining value, numeric value, unit, structured value, as-of date, source, content hash, and methodology version come only from the immutable snapshot row.
- The public package exposes its vintage label and shared cutoff and contains 12,373 rights-cleared canonical facts across 253 jurisdictions.
- Current `country_facts` contributes only descriptive metadata that the vintage schema did not copy; DAT-025 owns completing that temporal separation.
- The archive, BOM, G2 bundle, codebook, coverage report, source-input manifest, clean-room fixture, API documentation, rights manifest, and checksums were regenerated against the frozen contract.

## Boundary proof

The live comparison found 161 of the 12,373 selected source rows whose current text, numeric value, or as-of date differs from the frozen snapshot. The regenerated release matched the archived semantic bytes exactly and therefore emitted none of those post-cut changes under the old label.

A regression fixture supplies deliberately changed current values, source, and method alongside a frozen row. The mapper emits the frozen value/source/hash/method. A source-level test also fails if the loader returns to an active-`country_facts` query.

## Verification

- `npm run validate:release-bom:live`: pass; semantic SHA-256 `8be96e97fef153736f98ce56c8ab59a697f6396c3f61d3b07b12ba7823904ba9`.
- `npm run validate:g2-atlas`: pass; archive SHA-256 `203d9a32fde54cb955e4fb0bef00e5fb4b370e7c8e3b2f6e363074de022dd110`.
- `npm run reproduce:g2-atlas`: exact offline semantic and file hashes.
- `npm run validate:clean-room`: exact v2 fixture and export hashes without credentials or network.
- `npm run validate:backup-restore`: release archive matches the refreshed BOM.
- `npm test`: 628/628 pass.
- `npm run build`: pass, including all claims/documentation gates.
- Desktop light and 390px dark browser checks: layout and revised bulk-data copy render; both download routes return HTTP 200 with immutable caching and attachment filenames.

The local development console repeated the pre-existing country-search caret-style hydration warning. DAT-024 did not touch that component.
