# DAT-033 evidence

Completed 2026-07-11.

CI ingestion records, CI dimension scores, Conditions scores, and indicator history now retain the same lineage fields: indicator ID, source, upstream release, artifact SHA-256 and artifact kind, temporal coverage, license URL, transformation ID, substitution reason, and method version. Unique database keys include source and indicator.

The migration preserved existing rows. Exact retained 2024 publisher hashes remain labeled `publisher_bytes`. Records without retained publisher bytes received deterministic hashes of their normalized stored batch and are labeled `normalized_batch`. No raw-file provenance was inferred.

Live verification:

- `ci_source_ingestions`: 13 rows, 0 invalid
- `ci_dimension_scores`: 1,142 rows, 0 invalid
- `civica_conditions_scores`: 331 rows, 0 invalid
- `indicator_history`: 46,215 rows, 0 invalid
- Source-and-indicator duplicate groups: 0
- Authoritative migration ledger: 10/10
- Public schema fingerprint: `a985b2a0b2036a8186a7d013f00d0127366248fa48f64656fb009cbe75c81cb4`

Verification commands:

- `npm run validate:indicator-lineage`
- `npm run validate:indicator-lineage:live`
- `npm run validate:authoritative-migrations:live`
- `npx tsc --noEmit`
- `npm test` — 654/654 passed
- `npm run build` — passed
