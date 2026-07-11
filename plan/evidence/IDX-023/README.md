# IDX-023 evidence

- Machine-readable audit and triggers: `data/releases/index-misuse-audit-v1/result.v1.json`
- Canonical audit contract: `src/lib/ci/misuse-audit.ts`
- Reproduction and validation: `scripts/generate-index-misuse-audit.ts`, `scripts/validate-index-misuse-audit.ts`
- Reader resolution: `plan/research/index-adversarial-misuse-audit-v1.md`

The audit covers arbitrary specification, regime/cultural assumptions, false precision, league-table incentives, media misuse, consequential policy use, historical revision, and poorly observed countries. The current presentation fails without prematurely deciding the final tournament disposition.

```sh
npm run validate:index-misuse-audit
npx tsx --test src/lib/ci/misuse-audit.test.ts
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
