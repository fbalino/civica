# CLM-010 evidence — honest replication status surface

## Outcome

`/civica-index/replication` is now an explicit pre-G2/G3 status surface, not a product sheet for a package that does not exist. A `Not published` Chip and registered warning appear before a nine-component ledger. The ledger distinguishes shared G2 release work from the later G3/IDX-028 decision about whether the current Index is reproduced, redesigned, or retired.

The typed `replicationPackage` object in `src/lib/content/site-state.ts` is canonical. No component is currently `available` and none has an artifact link. Actual bundle construction, DOI registration, expected outputs, and clean-room work remain with their owning DAT-022, IDX-028, GOV-021, and QA-020 tasks.

## Fail-closed proof

- `scripts/validate-replication-surface.ts` runs in `npm run build`.
- Pre-G2 status forbids any `available` component or `href`.
- An `href` is permitted only for `available`, and `available` requires a valid path.
- A future `published` page status fails until every required component is available.
- Required component IDs are independently enumerated; missing or duplicate rows fail.
- Positive availability phrases, including any form of `download`, fail the source-copy scan.
- The exact non-availability statement is a registered G1 institutional-posture claim.

## Verification

- `npm run validate:replication-surface` — pass
- `npm run validate:public-claims` — pass: 29 claims, 35 markers, zero overclaim/grade/registry defects
- `npm run validate:numeric-claims` — pass: current live score coverage remains runtime-backed with a count-free fallback and is explicitly not a released output
- `npm run validate:doc-sources` — pass
- `npm run validate:design-tokens` — pass: no new drift
- focused replication tests — 12/12, including a valid all-available published fixture
- `npm test` — 161/161
- targeted ESLint — pass
- `npm run build` — pass: 85 static pages; known pre-existing Turbopack broad-trace warning only
- production desktop/mobile light/dark/reduced-motion/keyboard browser matrix — pass; see `browser-checks.md`

## Independent work and review

- `LN56 CLM-010 route inventory` — GPT-5.6 Luna, read-only artifact truth table
- `OP48 CLM-010 publication-contract adjudicator` — Claude Opus 4.8, binding pre-G2/G3 scope and validation contract
- `SN5 CLM-010 implementation` — Claude Sonnet 5, single implementation writer
- `OP48 CLM-010 independent acceptance review` — Claude Opus 4.8; one G2/G3 scope repair requested and applied
- Primary Codex — validator hardening, production browser QA, screenshot inspection, evidence, and final task closure

## Deliberate non-deliverables

CLM-010 does not create or publish the code bundle, data/rights manifest, codebook, checksums, pinned environment, reference outputs, DOI, or clean-room result. Their absence is now visible and enforced rather than disguised by future-facing copy.
