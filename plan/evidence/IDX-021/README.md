# IDX-021 evidence

- Frozen World Bank classifications: `data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json`
- Historical machine-readable audit: `data/releases/index-subgroup-fairness-v1/result.v1.json`
- Active replayable audit: `data/releases/index-subgroup-fairness-v2/result.v1.json`
- V2 protected-input manifest: `data/releases/index-subgroup-fairness-v2/manifest.v1.json`
- Analysis: `scripts/generate-index-subgroup-fairness.ts`
- Validator: `scripts/validate-index-subgroup-fairness.ts`
- Tested subgroup helpers: `src/lib/ci/subgroup-fairness.ts`
- Historical results report: `plan/research/index-subgroup-fairness-results-v1.md`
- Active results report: `plan/research/index-subgroup-fairness-results-v2.md`

All eight declared subgroup families appear in the active v2 result. Empty and
undersized cells are retained and labelled. No imputation or out-of-scope
territorial substitution is used. V1 remains immutable historical evidence,
but its live population/status/regime metadata was not pinned and it must not
be used as the replay target.

```sh
CIVICA_RESEARCH_INPUT_DIR=/protected/civica-research-inputs npm run validate:index-subgroup-fairness
npx tsx --test src/lib/ci/subgroup-fairness.test.ts
npx tsx --test src/lib/ci/subgroup-fairness-inputs.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
