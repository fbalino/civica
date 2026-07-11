# Index sensitivity and uncertainty results v1

**Panel:** `ci-research-panel-2000-2024-v3`
**Uncertainty inputs:** `ci-k1-uncertainty-inputs-2024-v2`
**Result hash:** `49576076eaf6920594d4c51290fb0164b8ab8e82abec5e4a7b05ab313aa8b7c6`

## Main result

K1's near-equal weight choice has little effect on 2024 country positions. Equal weights and full-panel PCA weights each have rank correlation above 0.9997 with the current method; 95% of absolute rank shifts are no more than three places.

Indicator and transformation choices matter more. Removing Freedom and Rights produces 95th-percentile rank movement of 33.2 places and a maximum of 51. Removing Democratic Quality produces 25.2 and 38. Removing Rule of Law produces 23 and 26. Percentile normalization and median aggregation each move the 95th percentile by 14 places. Substituting WGI Voice for V-Dem moves the 95th percentile by 11 and the maximum by 17.

Using exact publisher points in place of panel v3's republished points has median rank movement zero, 95th percentile three, and maximum six. This includes the six V-Dem point/bound mismatches discovered during uncertainty ingestion.

## Missingness, imputation, and coverage

The current sensitivity base covers 193 sovereign jurisdictions in 2024. Requiring all four dimensions covers 177. Exploratory median imputation reaches 194 but changes top-decile membership substantially: top-decile Jaccard falls to 0.739 and the 95th-percentile rank movement is 15. Imputation remains prohibited in the production and tournament specifications.

Complete-case ranks preserve ordering almost exactly on their common set, while absolute positions move because 16 partial rows leave the ranking universe. The artifact reports common-set rank correlation and absolute displacement separately.

## Publisher-bound and covariance stresses

The uncertainty analysis covers 177 countries with exact publisher points, V-Dem/WGI/CPI bounds, and a fixed Freedom House point because no per-country distribution exists. Moving all bounded inputs together to their lower or upper publisher limits produces median rank movement one, 95th-percentile movement four to 4.2, and maximum movement nine to 11. An alternating-direction stress produces median one, 95th percentile three, and maximum seven.

These are dependence and bound stresses. They are not probabilities or confidence intervals for a latent country score. Cross-source covariance remains unknown, and Freedom House uncertainty is unmeasured.

## Vintages, outliers, and dominant choices

V-Dem v14/v15 replacement changes 526 of 3,088 comparable rounded historical scores, with median zero, 95th percentile one, and maximum two. QoG benchmark revisions remain as reported under IDX-017. Five-to-95th-percentile winsorization leaves rank correlation near one, showing limited outlier influence on the common scale.

The dominant specification choices are indicator inclusion, aggregation/normalization, and source substitution. The precise near-equal weights are not dominant. This further weakens any argument that the current PCA-derived weight decimals add meaningful measurement information.
