# PUL-007 evidence

## Outcome

Pulse corroboration now counts versioned independent evidence groups instead of connector rows or nominal source IDs. `pulse-source-independence/evidence-family-v1` collapses the same snapshot, canonical URL, publisher family, declared underlying origin, and near-verbatim republication. Wire copies, syndicated accounts, mirrored NGO releases, and news references to one specialist report therefore contribute one group.

The reviewed regression fixture froze seven dependent pairs and five distinct-evidence pairs before evaluation. It reaches pairwise precision 1.00 and recall 1.00 against predeclared minimums of 0.95 and 0.90. This is an internal regression gate, not representative or external validation.

## Production evidence

The zero-payload live audit examined 529 reports attached to 384 events and derived 439 evidence groups. Thirty events contained at least one detected dependency. The detector found 59 same-publisher pairs and 580 near-verbatim pairs; the largest event contained 41 reports and 11 groups. The audit labels these counts descriptive rather than validation evidence.

The zero-write comparison found 157 material increases relative to the old connector-ID count and no material decreases; average planned confidence moved from approximately 0.350 to 0.353. The applied versioned run updated all 384 event confidence rows. The following score pass rewrote 325 experimental country-dimension rows from 206 published events across 65 countries. It did not classify or publish an event.

Live lineage validation reports nine current stage runs with zero missing required row links. The runtime method is `pulse-v2.3-beta`; the corroboration algorithm is `pulse-corroboration/evidence-family-v3`.

## Canonical artifacts

- Method resolution: `plan/research/pulse-source-independence-v1.md`
- Detector: `src/lib/pulse/v2/source-independence.ts`
- Reviewed fixtures: `src/lib/pulse/v2/source-independence.test.ts`
- Live aggregate audit: `scripts/audit-pulse-source-independence.ts`
- Corroboration integration: `src/lib/pulse/v2/corroborate.ts`
- Runtime contract: `src/lib/pulse/v2/runtime-method.generated.json`
- Public explanation: `/civica-index/methodology/pulse#source-independence`
- Shared-contract version: `civica-index-api-contract-pulse-independence-v1`
- Durable decision: `APR-D115`

## Boundaries

The detector cannot establish statistical or editorial independence. It can miss paraphrased or undisclosed reuse, its publisher aliases are incomplete, and the fail-closed unresolved-publisher rule can merge genuinely separate reporting. PUL-023 owns representative held-out accuracy. PUL-011 owns separately persisted decision records. PUL-008 and PUL-009 own operating-source coverage and observability.

## Verification

See `browser-checks.md` for responsive theme checks and screenshots. The following checks pass:

```sh
npm run validate:pulse-source-independence
npm run audit:pulse-source-independence:live
npm run validate:pulse-runtime:live
npm run validate:pulse-version-lineage:live
npm run validate:design-tokens
npm run validate:index-change-control:run
npm run validate:claims-docs
node plan/tools/validate-master-plan.mjs
npm run build
```

The full suite contains 774 passing tests. The production build renders 97 pages. It retains the pre-existing non-fatal Next.js NFT trace warning from `next.config.ts`.
