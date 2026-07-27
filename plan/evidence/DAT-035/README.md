# DAT-035 — frozen Index adapter-version reconciliation

## Classification

PLT-023 replaced the direct Neon HTTP-client factory in `src/lib/ci/ingest.ts`
with the shared cancellation-aware serverless factory. This is a **nonsemantic
transport change** for `ci-beta-2024-Q4`: it changes the bounded connection
construction, not the publisher bytes, source selection, parser,
normalization, methodology, row identities, scores, ranks, retrieval time, or
upstream vintage.

The source-input manifest must nevertheless carry the exact raw adapter-code
hash. It changed from
`sha256:686b2665c71eda0c4429e2fa467362d84e3b83be2c1e9d70617bed18e51bc966`
to
`sha256:419ad10a5ea53b8b8eb981a31eab85847efaa9ae9476b8638fcb03f19f2a9257`.
The four publisher content hashes, access URLs, retrieval timestamp, versions,
vintages, coverage, redistribution posture, and released value-group checksums
remain unchanged.

While reconciling the controller, validation also found that the checked
Index/Pulse snapshot had not recorded the already shipped PUL-036 stored-run
agreement changes and PLT-022's bounded subject-attribution call. Those remain
protected `weight_or_model` changes; this task does not normalize or relabel
them. The appended record binds their existing PUL-036 evidence and required
model validation before restoring the controller head.

## Result

- Regenerated the checked source-input manifest from the existing four frozen
  captures only.
- Regenerated the derived raw-retention manifest so its compliant
  reconstruction records use that exact adapter hash and its own manifest hash
  remains valid.
- Added a narrowly tested nonsemantic Index change-control normalization for
  this exact factory substitution. The raw adapter hash is intentionally not
  normalized.
- Appended a model-control record for the previously unrecorded PUL-036/PLT-022
  Pulse source changes, using their retained evidence; it does not mutate a
  released Index or Pulse output.

No publisher payload, production database data, release score, historical
retrieval field, or source lineage was edited. A future source/parser/model
change remains protected and requires a methodology record.

## Verification

Run on 2026-07-18:

```sh
npm run generate:source-input-manifest -- --release-id=ci-beta-2024-Q4 --pipelines=index.current-beta --out=data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json
npm run generate:raw-retention
node --import tsx --test src/lib/ci/index-change-control.test.ts src/lib/ci/index-change-control-nonsemantic.test.ts src/lib/data/__tests__/source-input-manifest.test.ts
npm run validate:source-input-manifest
npm run validate:raw-retention
npm run validate:index-change-control:run
npm run validate:ci-current-release
npm run validate:ci-release-selection
npm run validate:ci-series-provenance
npm run validate:ci-research-panel
npm run validate:index-research-archive
npm run validate:index-pulse-classification-state
npm run validate:pulse-agreement
npm run validate:pulse-runtime
npm run typecheck
npx eslint src/lib/ci/index-change-control.ts src/lib/ci/index-change-control-nonsemantic.test.ts
node plan/tools/validate-master-plan.mjs
git diff --check
```
