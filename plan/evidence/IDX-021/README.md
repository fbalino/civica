# IDX-021 evidence

- Frozen World Bank classifications: `data/releases/index-subgroup-classifications-2026-07-11-v1/classifications.v1.json`
- Machine-readable audit: `data/releases/index-subgroup-fairness-v1/result.v1.json`
- Analysis: `scripts/generate-index-subgroup-fairness.ts`
- Validator: `scripts/validate-index-subgroup-fairness.ts`
- Tested subgroup helpers: `src/lib/ci/subgroup-fairness.ts`
- Results report: `plan/research/index-subgroup-fairness-results-v1.md`

All eight declared subgroup families appear in the result. Empty and undersized cells are retained and labelled. No imputation or out-of-scope territorial substitution is used.

```sh
npm run validate:index-subgroup-fairness
npx tsx --test src/lib/ci/subgroup-fairness.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
