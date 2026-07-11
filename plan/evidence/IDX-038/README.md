# IDX-038 evidence — corrected Freedom House input identity

Panel v1 carried Freedom House `fh_total_score` on a 0–100 scale. The live Index and K1 use `pr_cl_total`, the combined Political Rights and Civil Liberties ratings on an inverted 2–14 scale. They are different publisher fields and cannot be substituted.

`ci-research-panel-2000-2024-v2` preserves v1 and replaces only that series. The exact publisher workbook matches SHA-256 `d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88`. It supplies ratings for 2006–2024; 2000–2005 are explicit `outside_comparable_series` gaps.

- Panel row SHA-256: `0d232534be46fd3c4c18d7c9d278b41e258ec72c2f42b1d7fdc2796286aa7a37`
- Coverage SHA-256: `2e89d1bdcd1fed59031a64576917c506c31562e5c36a5591301f056841e99f40`
- Temporal-break SHA-256: `227b9c7ef58b6fba615378ceb7a755ee7a3b2892e27563dd366d78a85b59b237`
- 24,250 cells: 19,289 observed and 4,961 missing

Candidate set v2 names the correct K1 field. Preregistration v2 pins the corrected panel and candidate commits without changing holdouts, thresholds, or decision rules and records that no outcome data was inspected. Baseline v2 reads the corrected panel; B2, B3, and factor-model hashes changed despite unchanged complete-case counts.

`npm run validate:ci-tournament-panel:v2:live`, `npm run validate:index-tournament-preregistration`, and `npm run validate:index-tournament-baselines:live` pass. V1 panel, protocol, and baseline artifacts remain at their original paths.
