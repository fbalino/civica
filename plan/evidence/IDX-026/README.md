# IDX-026 evidence

- Machine resolution: `data/releases/index-disposition-2026-07-v1/resolution.v1.json`
- Canonical contract and public summary: `src/lib/ci/index-disposition.ts`
- Published reader surface: `/civica-index/methodology#disposition`
- Plain-language resolution: `plan/research/index-disposition-resolution-v1.md`
- Generator and validator: `scripts/generate-index-disposition.ts`, `scripts/validate-index-disposition.ts`

The resolution selects `source_native_dashboard_only` for the public product. K1 is preserved as versioned, nonrecommended research. The resolution rejects an original-measurement claim and a secondary validated-index claim, but it does not permanently retire the research while bounded derivative utility remains unresolved. It records the evidence, three failed findings, all unresolved human and expert gates, the strongest arguments for retaining K1 research, current limitations, and four mandatory reconsideration conditions.

The methodology page renders the canonical public summary and selected-product link. Its research warning states that the tournament has no winner, K1 fails originality, the current league-table presentation fails misuse resistance, and external gates remain pending. Stale copy saying longitudinal/substitution analysis was still planned, promising a replication date, or claiming both historical series were already available through the API was removed. Browser verification confirmed the disposition, dashboard link, and absence of those statements.

```sh
npm run generate:index-disposition
npm run validate:index-disposition
npx tsx --test src/lib/ci/index-disposition.test.ts
npm run validate:content-templates
npm run validate:design-tokens
npm run validate:claims-docs
npx tsc --noEmit
node plan/tools/validate-master-plan.mjs
```
