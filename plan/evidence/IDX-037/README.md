# IDX-037 evidence

## Outcome

IDX-037 is complete through the checklist&rsquo;s claim-narrowing option.

- The Phase 5.3 PCA remains the historical derivation record for the archived Beta weights.
- Its sample is 46 complete country profiles from one 2023 cross-section.
- The numeric eigenvalues, correlations, loadings, suggested weights, and adopted historical weights are unchanged.
- The public appendix no longer describes PC1 as validation of a universal governance-quality construct.
- Residual components are not called noise, and the Kaiser result is bounded to the sample.
- Administrative Capacity was absent. No distinctness, redundancy, selection, rejection, factor, or rotation result is claimed for a fifth input.

The later `index-dimensionality-analysis-v1` result remains the temporal evidence. Its frozen four-input panel separates pooled and between-country levels from within-country variation and annual differences. It narrows the interpretation of the old cross-section but does not retroactively validate its weights or answer the fifth-input question.

## Enforcement

`npm run validate:index-pca-scope` binds the historical sample/year, the temporal release and method, the level/change contrast, the explicit unrun fifth-dimension status, and the public prose. It fails on the former latent-factor, noise-floor, structural-certainty, and conditional fifth-dimension language. The same fixtures run in the unit suite.

Append-only change record `idx-037-pca-claim-scope` advances the research version to `civica-index-pca-scope-2026-07-v1`. Snapshot `246141a41b81fed1f5cd7e7911da51993b22925f227c3eeeb62cf6e9c3a9efce` binds 88 protected files and records eight weight/model and presentation changes.

## Documentation

- Release note: `plan/research/index-pca-claim-scope-release-note.md`
- Migration decision: `plan/research/index-pca-claim-scope-migration.md`
- Public record: `content/methodology-pca-appendix.md`
- Later temporal evidence: `plan/research/index-dimensionality-results-v1.md`
- Decision: APR-D108 in `plan/DECISIONS.md`

## Verification

```sh
npm run generate:pca-analysis -- --check
npm run validate:index-pca-scope
node --import tsx --test src/lib/ci/pca-claim-scope.test.ts
npm run validate:content-templates
npm run validate:doc-sources
npm run validate:index-change-control:run
npm run validate:design-tokens
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```
