# IDX-008 evidence — candidate specification set

## Candidate set

`civica-index-candidate-set/v1` defines six candidates across six distinct kinds:

1. Governance Evidence Dashboard — no-score reference
2. Hardened Four-Input Composite — derivative benchmark
3. Measurement Concordance — meta-measurement
4. Power and Transfer Ledger — institutional fact ledger
5. Constitution-to-Practice Pairings — evidence pairing
6. Institutional Constraint Map — institutional structure

The readable specification is `plan/research/index-candidate-specifications-v1.md`. The field-complete executable contract is `src/lib/ci/candidate-specifications.ts`.

## Completeness and separation

Every candidate declares its construct, unit, cadence, exact claim and nonclaims, inputs, transformations, missingness, uncertainty, versioning, normative choices, expected added value, public presentation, validation, and retirement rule. The dashboard/no-score option is mandatory. All six constructs and candidate kinds are distinct; the current composite appears only once as a derivative benchmark.

Every specification has `hiddenCountryQualityGrade=false`. The source-disagreement, fact-ledger, evidence-pairing, and institutional-structure candidates explicitly prohibit aggregation into an overall country judgment.

## Verification

- `npm run validate:index-candidate-specifications` passes for the canonical six-candidate set.
- A seeded two-copy cosmetic set fails for too few candidates, no dashboard, repeated kind, and repeated construct.
- Fixtures prove the presence of no-score, fact-ledger, and institutional-structure alternatives and the universal no-hidden-grade boundary.
- All 677 repository tests pass.
