# GOV-013 — Atlas/data-curation external-review packet

Completed 2026-07-11.

## Outcome

`civica-atlas-review-packet/2026-07-v1` binds 16 exact artifacts and ten bounded data-curation questions around the frozen `atlas-2026-07-11-g2-rc1` release. The inventory includes the release archive and manifest, checksums, codebook, complete schema dictionary, rights and source-input manifests, release BOM, clean-room evidence/instructions, coverage and quality reports, known limitations, citation metadata, correction/retraction/supersession policy, and the canonical GOV-003 project disclosure.

Every linked path is read during generation, byte-counted, and SHA-256 hashed. The validator fails on missing paths, changed bytes, missing required artifact classes, questionnaire drift, or stronger endorsement status. The wrapper adds no restricted publisher payload.

## Verification

- `npm run generate:atlas-review-packet`
- `npm run validate:atlas-review-packet`
- `npm run validate:g2-atlas`
- `npm run validate:clean-room`
- `npx eslint src/lib/research/atlas-review-packet.ts src/lib/research/atlas-review-packet.test.ts scripts/generate-atlas-review-packet.ts scripts/validate-atlas-review-packet.ts`
- `npx tsc --noEmit`
- `node plan/tools/validate-master-plan.mjs`
- `npm run build`

Semantic hash: `2cff819c37f15fcd1471555eb3c41873e1d427d55e4bb0749e453937fc569765`
(the packet reproduces from current code; its hash advanced as the rights
manifest and G2 bundle it inventories legitimately changed — most recently the
GOV-003 disclosure binding).

The packet is ready to review, but no review or endorsement has occurred and no reviewer was contacted.
