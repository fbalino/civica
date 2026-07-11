# IDX-009 evidence — mandatory non-composite alternatives

## Provenance-native alternatives

- K2 Measurement Concordance uses Civica's source-disagreement, common-coverage, source-dependence, vintage, and uncertainty machinery. It grades neither jurisdictions nor governments.
- K3 Power and Transfer Ledger uses statement-level provenance, reconciliation-style rulebooks, disputed states, immutable vintages, and dated institutional facts. It prohibits aggregation into country quality.

## Institutional-structure alternative

K5 Institutional Constraint Map represents sourced formal-power relations between institutions with a closed relation taxonomy and directed graph. Unknown relations remain unknown. It states that formal authority is not effective practice and that more constraints are not necessarily better. It permits no weighted total or quality score.

## Fail-closed proof

`candidateAlternativeCoverageErrors()` requires both alternative families and checks an explicit anti-quality-grade boundary on every qualifying candidate. A seeded candidate set containing only the dashboard and composite fails with:

- `no provenance-native disagreement or fact alternative`
- `no institutional-structure alternative`

`npm run validate:index-candidate-specifications` and all focused fixtures pass for the canonical set.
