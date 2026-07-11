# IDX-024 evidence

- Canonical package: `data/releases/index-tournament-results-package-v1/`
- Package manifest: `data/releases/index-tournament-results-package-v1/manifest.v1.json`
- Artifact table: `data/releases/index-tournament-results-package-v1/artifact-inventory.v1.csv`
- Failure and pending-state ledger: `data/releases/index-tournament-results-package-v1/error-ledger.v1.json`
- Reproduction logs: `data/releases/index-tournament-results-package-v1/logs/`
- Executable contract: `src/lib/ci/tournament-results-package.ts`
- One-command runner: `scripts/reproduce-index-tournament-package.ts`
- Independent hash validator: `scripts/validate-index-tournament-package.ts`

The complete run regenerated or validated 22 artifacts through 17 stages: the K0 dashboard, K1–K5, every frozen baseline, the shared evaluation suite, dimensionality, validity, longitudinal, out-of-sample, uncertainty, sensitivity, source-dependence, subgroup, and misuse evidence. It records the v3 preregistration and panel, hashes the complete `src/lib/ci` analysis tree and every invoked generator, locks the Node/npm/OS/package-lock environment, names deterministic seeds, and retains one sanitized canonical log per stage.

The package contains aggregate manifests and results only; source-restricted country values remain private. Twelve result artifacts are registered confirmatory. The exploratory registry is empty and any future exploratory scenario must use a separately labelled release. The nine-entry ledger preserves failures, insufficient evidence, and human-review dependencies. `winnerSelected` is false so IDX-024 cannot preempt the frozen rule application in IDX-025.

```sh
npm run reproduce:index-tournament-package
npm run validate:index-tournament-package
npx tsx --test src/lib/ci/tournament-results-package.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
