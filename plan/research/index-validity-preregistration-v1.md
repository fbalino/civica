# Index convergent and discriminant validity preregistration v1

**Registered:** 2026-07-11 before validity correlations were calculated  
**Protocol:** `civica-index-validity-preregistration/v1`

## Scope

The frozen panel contains one external construct that is not a K1 or K2 input: UNDP's Human Development Index. HDI is related to governance levels but does not define governance quality. It can provide a limited convergent and discriminant check. It cannot validate the Civica Index by itself.

V-Dem LDI, WGI Voice and Rule of Law, Freedom House PR+CL, and CPI are K1 inputs. Their correlations with K1 are mathematically induced and will be reported only as mechanical diagnostics. They never count as convergent validity.

K3's historical transfer labels, K4's blinded scholar judgments, and K5's double-coded expert relations are not available. Those candidates remain insufficient for external validity rather than borrowing HDI as an irrelevant criterion.

## Frozen hypotheses

| ID | Test | Expected result |
|---|---|---|
| H1 | K1 country-mean level against country-mean HDI | Spearman rho from 0.30 up to but excluding 0.80. Lower is weak convergence; 0.80 or higher flags development confounding. |
| H2 | Annual cross-sectional K1–HDI associations | Median Spearman rho at least 0.30; report every year. |
| H3 | Consecutive K1 change against consecutive HDI change | Absolute Spearman rho no greater than 0.30. |
| H4 | K2 concordance spread against HDI level | Absolute Spearman rho no greater than 0.30. |
| H5 | K1 against each constituent input | Report only. No value can pass a validity gate. |

The common period is 2012–2023. Missing observations are excluded pairwise without imputation. Tied ranks use average ranks. Uncertainty uses 2,000 deterministic jurisdiction-cluster bootstrap resamples and percentile 95% intervals. Effect sizes and intervals are reported without a null-hypothesis significance gate; H1–H4 are noncompensating descriptive checks.

Candidate code and parameters were frozen before this protocol. External values cannot be used for fitting, weighting, threshold selection, or amendment of the candidate definitions.
