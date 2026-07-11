# IDX-035 evidence

## Outcome

`civica-index-research-selection-2026-07-v1` prevents stored Civica Index releases from mixing at calculation or read time.

- `src/lib/ci/release-selection.ts` is the closed registry for Beta-R3, Beta-R4, and Beta-R5.
- Each release pins its id, methodology, quarter, vintage, five permitted source-indicator identities, artifact hashes, V-Dem-first fallback priority, input transform, composite algorithm, and display transform.
- Calculation, country detail/history, comparison, rankings, peer-grouping, government-type, and research-summary reads select the exact registered release.
- Deprecated score APIs accept `release`; `quarter` is only a consistency assertion. Free-form score-method selection and latest-quarter fallback are removed.
- The release fixture contains overlapping R4/R5 rows and proves that only the requested release survives. Unknown source, indicator, artifact, transform, method, or display combinations fail closed.
- Stored rows and historical releases were not rewritten or deleted.

## Change control

The first post-baseline IDX-030 record advances the Index research version from `civica-index-disposition-2026-07-v1` to `civica-index-research-selection-2026-07-v1`. Snapshot `d9b04e845ff3e5ca89f4bcfbe094ee526f5fef32c30271de13dea2f67feb5ea7` binds 75 protected files and records all 14 changed semantic consumers across input, transform, and presentation categories.

Historical change records retain their evidence hashes in the append-only registry and Git history; only the registry head is compared with intentionally mutable live documentation and tests. Current category requirements apply to the head, so adding a future validator cannot retroactively invalidate an older record.

## Documentation

- Migration and rollback: `plan/research/index-release-selection-migration.md`
- Release note: `plan/research/index-release-selection-release-note.md`
- Reader methodology: `content/methodology-civica-index.md`
- Decision: APR-D106 in `plan/DECISIONS.md`

## Verification

```sh
node --import tsx --test src/lib/ci/release-selection.test.ts
npm run validate:ci-release-selection
npm run validate:api-docs
npm run validate:content-templates
npm run validate:index-change-control:run
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```
