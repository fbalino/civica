# IDX-015 evidence — convergent and discriminant validity

The hypotheses were committed in `0258620` before validity correlations were calculated. The protocol freezes five tests, the 2012–2023 common period, pairwise-complete missingness, average-rank Spearman correlation, 2,000 deterministic jurisdiction-cluster bootstrap samples, and noncompensating interpretation rules.

H1–H4 pass their frozen bounded checks: K1 country-mean level versus HDI is 0.667 (95% interval 0.574–0.747), the median annual association is 0.658 (0.554–0.742), consecutive K1 and HDI changes correlate 0.019 (−0.027–0.064), and K2 spread versus HDI is −0.078 (−0.186–0.036).

Every K1 constituent-source association is reported separately as `mechanical_input_association_not_validity`. The validator requires `noCandidatePassesFromInputSimilarity: true`. K3, K4, and K5 retain explicit insufficient-evidence states because their construct-matched external labels have not been collected.

Artifacts:

- `plan/research/index-validity-preregistration-v1.md`
- `plan/research/index-validity-results-v1.md`
- `data/releases/index-validity-analysis-v1/result.v1.json`

`npm run validate:index-validity-preregistration`, `npm run validate:index-validity`, focused rank/bootstrap tests, and TypeScript pass. Live regeneration matches result hash `6b7f3642f135b8ca217b47ae6c44f8bbd98fa3edd1e7448b99f6927266cd5b03`.
