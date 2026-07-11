# IDX-020 evidence

- Machine-readable result: `data/releases/index-source-dependence-v1/result.v1.json`
- Source/ecosystem contract: `src/lib/ci/source-ecosystem-dependence.ts`
- Reproducible generator: `scripts/generate-index-source-dependence.ts`
- Fail-closed validator: `scripts/validate-index-source-dependence.ts`
- Research report: `plan/research/index-source-ecosystem-dependence-v1.md`
- Exact upstream workbook hashes and inspected source fields are recorded in the result.
- Publisher-level leave-one-out results are imported from the immutable IDX-019 release.
- Upstream-family deletion is explicitly unidentifiable rather than approximated.

Verification:

```sh
npm run validate:index-source-dependence
npx tsx --test src/lib/ci/source-ecosystem-dependence.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
