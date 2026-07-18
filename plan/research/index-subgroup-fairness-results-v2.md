# Civica Index coverage, missingness, and subgroup fairness

**Release:** `index-subgroup-fairness-v2`

## Replay boundary

This supersedes the v1 result only as the active reproducibility target. V1
remains immutable historical evidence. Its population, entity-status, and
regime strata were read from mutable live rows, and a later replay changed the
small-state classification. V2 captures the normalized restricted inputs in a
protected content-addressed cache before analysis. The public manifest and
result both name the exact input hash; the restricted values themselves are
not redistributed.

## Scope and publication

The frozen v2 input contains 194 sovereign states. K1 publishes for 193 and
withholds one. No territory or limited-recognition entity was added to fill an
empty subgroup. The frozen snapshot contains no row marked disputed, so
disputed-state performance is unestimable and reported as a zero-cell result.

Publication, score distribution, publisher-bound coverage, and
evidence-scarcity simulations are reported by region, World Bank income class,
frozen BR/CGV regime, media-environment stratum, small-state status, data
availability, and source availability. Performance language is suppressed for
cells below 30. No external country-quality truth exists, so larger cells are
descriptive rather than accuracy estimates.

## Frozen finding

The new protected snapshot classifies 44 states as below 1.5 million
population, of which 43 publish. The remaining 150 states all publish. This is
the only v1-to-v2 subgroup difference; it validates the necessity of retaining
the metadata snapshot rather than accepting live table drift.

The evidence-scarcity conclusion is unchanged. Among 177 complete profiles,
masking CPI raises the median score by one point and 33.9% move downward. The
preregistered failure rule was a median change below -1 or more than 60%
moving downward, so K1 does not fail that narrow mechanical rule. This does not
clear the separate originality gate or establish subgroup accuracy or fairness
for consequential use.

## Limits

The media grouping overlaps one K1 information ecosystem. Frozen regime and
population strata are descriptive, not causal or historical classifications.
Income is taken from the separately frozen World Bank classification release.
Missing values remain missing; no imputation, zero substitution, or
out-of-scope territorial substitution is used.
