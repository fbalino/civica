# Civica Index dimensionality results v1

**Method:** `civica-index-dimensionality/v1`  
**Frozen panel:** `ci-research-panel-2000-2024-v3`  
**Analysis hash:** `07b3b8b5513622fb3a7f3fabb8e8e811d0f55ae4f7a642f7f1681cfeb8ddf954`

## Finding

The four current Index dimensions share a strong cross-country level factor. They do not share an equally strong change factor.

The first principal component explains 87.3% of pooled country-year variance and 88.1% of variance between country averages. It explains 52.5% after removing each country's mean and 35.9% of consecutive annual changes. A high country-level score can therefore summarize a broad level of established governance ratings, but it should not be described as a single measure of governance change.

| Analysis level | Complete observations | PC1 variance explained |
|---|---:|---:|
| Pooled country-years | 2,270 | 87.3% |
| Between-country averages | 178 | 88.1% |
| Within-country deviations | 2,270 | 52.5% |
| Consecutive annual changes | 2,083 | 35.9% |

The remaining annual-change components explain 23.6%, 22.5%, and 18.0%. Change is distributed across several directions rather than dominated by the level factor.

## Stability

Annual cross-sections are stable from 2012 through 2024. PC1 explains 86.3% to 88.3%, and every annual loading vector has cosine similarity above 0.9999 with the pooled loading vector. The three broad time blocks are similarly stable.

Regional level results range from 74.5% in Asia to 91.9% in Oceania. Regime-stratified results vary more: PC1 explains 50.8% among rows currently grouped as royal dictatorships and 91.1% among rows currently grouped as semi-presidential democracies. Loading directions remain broadly similar, but explained variance does not. Small and restricted slices should not be treated as separate validated models.

## Inputs and assumptions

The analysis uses complete profiles for Democratic Quality, Rule of Law, Freedom and Rights, and Corruption Control. Values are transformed only through their declared native bounds and direction. Democratic Quality uses the frozen V-Dem-first, WGI Voice fallback rule. There is no imputation, nearest-year fill, or freshest-value substitution.

All analyses use Pearson correlation PCA. PC1 signs are oriented to a positive loading sum. The checked result includes full correlation matrices, eigenvalues, variance shares, and loadings for pooled, between-country, within-country, first-difference, annual, time-block, continent, and regime slices.

The region field is Civica's continent grouping. Regime slices use the latest available BR/CGV-derived taxonomy as a descriptive stratum repeated across the historical profiles; they are not historical regime-year classifications and cannot support causal claims about regime type.

## Implication for the tournament

K1 may be evaluated as a derivative summary of cross-country levels. It cannot use the strong level factor as evidence that its annual movements form one validated construct. Longitudinal responsiveness, source-update artifacts, lead/lag behavior, and known-change tests remain separate gates under IDX-017.

The checked CSV contains every reported slice and loading. The checked SVG compares level, between-country, within-country, and annual-change variance. `npm run validate:index-dimensionality` regenerates and byte-compares the result, table, and figure.
