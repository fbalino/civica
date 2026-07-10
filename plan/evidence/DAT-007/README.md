# DAT-007 evidence — deterministic source precedence

Status: implementation complete on 2026-07-10.

## Outcome

`source-precedence/v1` is the adopted canonical-selection contract. It covers:

- eligibility and plausibility rejection
- measured observations before projections
- Group A/C CIA incumbency and manual-review disputes
- Group B effective-vintage ordering
- native statistical office and lineage-aware equal-vintage precedence
- material-error and reference-quality guards
- real-GDP-growth measurement comparability
- upstream-family disclosure for republished rows
- stable source-ID tie-breaking after all substantive rules

Every selected canonical now includes six ordered `decisionTrace` categories:
row eligibility, measurement partition, source lineage, precedence, guard
result, and final selection with effective vintage and contract version.
Public country API provenance returns the same trace.

## Defect found and repaired

The first live API check found that Argentina population could select World
Bank while the live resolver worked example selected UN Data. Both rows had the
same UN WPP value and vintage, and the old same-tier comparison allowed database
row order to decide. The adopted rule now prefers the registered UN direct-
access path to a downstream republisher and uses source ID as a final stable
tie-break. Both row orders select `un_data`; all eight live worked examples
pass.

## Executable contract

- `plan/decisions/source-precedence-v1.md` — adopted resolution
- `src/lib/factbook/reconcile/resolver.ts` — implementation and trace builder
- `src/lib/factbook/reconcile/types.ts` — strict decision reason/trace types
- `src/lib/factbook/reconcile/source-precedence.test.ts` — ten focused rules
- `scripts/validate-source-precedence.ts` — contract/prose/API/fixture gate
- `src/lib/factbook/reconcile/api.ts` — public provenance trace
- `src/lib/api/contract/schemas.ts` — strict API schema
- `/country/methodology/reconciliation#resolver` — public explanation

## Verification

- `npm run validate:source-precedence` passed.
- Ten focused precedence fixtures passed.
- All eight live database resolver examples passed.
- API example/schema validation, numeric/public claims, terminology, content,
  TypeScript, design tokens, 408 tests, and the production build passed.
- The live Argentina API returned `un_data`, all six trace steps, and a final
  selection naming `source-precedence/v1`.
- Desktop and 390×844 Playwright screenshots of the methodology page passed.
