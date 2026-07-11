# Civica Index coverage, missingness, and subgroup fairness

**Release:** `index-subgroup-fairness-v1`

## Scope and publication

The frozen 2024 panel contains 194 sovereign states. K1 publishes for 193 and withholds one. No territory or limited-recognition entity was added to fill an empty subgroup. The sovereign-state spine contains no row marked disputed, so disputed-state performance is unestimable in this release and reported as a zero-cell result.

Publication, score distribution, publisher-bound coverage, and evidence-scarcity simulations are reported by continent, World Bank income class, current BR/CGV regime, media-environment stratum, small-state status, data availability, and source availability. Performance language is suppressed for cells below 30. No external country-quality truth exists, so larger cells remain descriptive rather than being mislabeled accuracy estimates.

## Coverage patterns

The sole withheld state is also missing a World Bank income class and the media-environment input. Publication is complete in Africa, Asia, North America, Oceania, and South America; Europe publishes 43 of 44. It publishes 44 of 45 states below 1.5 million people. All 172 states with the frozen media-environment observation publish, while 21 of 22 missing that observation publish.

Publisher-specific uncertainty remains incomplete. The maximum is three bounded dimensions because Freedom House publishes no country probability distribution. Small states average 2.53 bounded dimensions versus 3.00 among other states. The missing-media group averages 2.05. These are uncertainty-coverage differences, not confidence intervals.

## Does evidence scarcity lower the score?

It does not do so mechanically under the frozen test. The current partial profiles contain three sources rather than four, primarily because CPI is absent. Among 177 complete profiles, masking CPI raises the median score by one point; 33.9% move downward. The preregistered operational failure rule was a median change below −1 or more than 60% moving downward. K1 does not fail that rule.

The raw association runs in the opposite direction: source count and score have Spearman rho −0.318, and the 16 published three-source profiles have a median score of 76 versus 43 for complete profiles. This is descriptive selection, driven largely by small high-scoring states with thinner coverage. It is not evidence that missingness improves governance. It does show why missing values must remain visible and why coverage must not be interpreted as quality.

## Limits

The media grouping uses the frozen V-Dem expression-practice measure and therefore overlaps one K1 information ecosystem. Current regime is a descriptive stratum, not a historical classification. Population is the Atlas cache value at analysis time. Income classes are frozen from the World Bank API capture. Tied data-availability and source-count values prevent balanced terciles; the release retains the observed strata rather than splitting identical values by country name.

K1 clears the narrow mechanical scarcity test. This does not clear its failed originality gate, establish subgroup accuracy, or establish fairness for consequential use.
