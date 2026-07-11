# PUL-006 evidence

## Outcome

Pulse clustering now uses normalized event identity rather than an ingest-time country bucket. The production method is `pulse-cluster/normalized-global-union-find-v3` with `pulse-event-identity/multilingual-v1` and multilingual MiniLM embeddings. Unresolved reports remain eligible, and classification reads one combined row per cluster before the separate subject-country decision.

Fixtures prove that English and Spanish reports from different source families merge despite conflicting provisional countries. Similar same-day Oaxaca and Puebla rulings remain separate. The lexical fallback and semantic path share the same identity guard.

## Production evidence

The zero-write live run examined 203 previously unclustered reports and proposed 191 clusters. A bounded local title sample showed coherent duplicate groups. The apply run wrote only cluster assignments and its immutable stage identity; it did not classify, publish, or score any report.

The frozen release at `/api/v1/pulse/cluster-coverage` now covers 1,379 reports and 1,106 clusters. It separates 915 legacy clusters from 191 v3 clusters. The release records 95 multi-report clusters and only one cluster with more than one recorded source family. That source concentration is a limitation, not a validation result.

## Canonical artifacts

- Method resolution: `plan/research/pulse-clustering-v3.md`
- Normalized identity: `src/lib/pulse/v2/event-identity.ts`
- Clustering implementation: `src/lib/pulse/v2/cluster.ts`
- Runtime contract: `src/lib/pulse/v2/runtime-method.generated.json`
- Frozen coverage release: `src/lib/pulse/v2/cluster-coverage.generated.json`
- Public report: `/api/v1/pulse/cluster-coverage`
- Durable decision: `APR-D114`

## Boundaries

PUL-007 still owns source-family independence and republication detection. PUL-012 owns primary and affected jurisdiction evidence, including clusters with no provisional jurisdiction. PUL-023 owns held-out pairwise and cluster-level accuracy. The coverage report is descriptive and cannot satisfy those tasks.

## Verification

See `browser-checks.md` for the four responsive theme checks and screenshots. The following checks pass:

```sh
npx tsc --noEmit
npm test                         # 771 tests
npm run validate:pulse-cluster-coverage
npm run validate:pulse-runtime:live
npm run validate:pulse-version-lineage:live
npm run validate:content-templates
npm run validate:api-docs
npm run validate:design-tokens
npm run validate:index-change-control:run
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```
