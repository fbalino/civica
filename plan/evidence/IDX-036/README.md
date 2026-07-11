# IDX-036 evidence

## Outcome

`ci-series-provenance-audit-2026-07-v1` records the actual calculation clocks for every stored Civica Index methodology/quarter group.

- Eight groups contain 1,236 composite rows.
- Reference periods are 2023-Q4 or 2024-Q4.
- Every calculation occurred in 2026.
- No row group retains an original 2023 or 2024 Civica publication cut.
- All eight groups are therefore `harmonized_backcast`.
- The supported `as_published_release` state is intentionally empty because no genuine historical release exists.

The legacy database column is a timestamp without time zone. The audit converts it using the recorded `America/Montevideo` execution environment and discloses that inference. New series contracts require ISO calculation times.

## Contract

`src/lib/ci/series-provenance.ts` keeps observation period, original publication cut, calculation time, method, series type, and citation separate. It rejects a calculation after an alleged publication cut, a backcast with an invented cut, and citations that turn an observation year into an as-published vintage.

The selected Governance Evidence release and the three closed Beta releases carry this contract. The deprecated Index APIs include it in response metadata. Governance Evidence shows it on the page and in its rights-safe JSON export. `series_type=as_published_release` is a valid query with a clear unavailable response; `series_type=harmonized_backcast` selects the current release.

Because the selected-product implementation changed, `governance-evidence-review-packet-2026-07-v2` freezes the revised code, series audit, 49-artifact inventory, and 11-question review form. The earlier v1 directory remains unchanged.

## Change control

Append-only record `idx-036-series-provenance` advances the research version to `civica-index-series-provenance-2026-07-v1`. Snapshot `5fba22427074efdc3743391cddb877b82b23e3c46d064c9ce72e3b9661be50cc` binds 81 protected files and records 17 input/presentation changes.

## Documentation

- Audit: `data/releases/ci-series-provenance-audit-2026-07-v1/manifest.v1.json`
- Migration: `plan/research/index-series-provenance-migration.md`
- Release note: `plan/research/index-series-provenance-release-note.md`
- Reader method: `content/methodology-civica-index.md#vintages`
- Decision: APR-D107 in `plan/DECISIONS.md`

## Verification

```sh
npm run validate:ci-series-provenance
npm run validate:ci-series-provenance:live
node --import tsx --test src/lib/ci/series-provenance.test.ts src/lib/ci/governance-evidence.test.ts
npm run validate:api-docs
npm run validate:content-templates
npm run validate:index-change-control:run
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```
