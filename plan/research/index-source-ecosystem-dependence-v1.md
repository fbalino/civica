# Civica Index source and ecosystem dependence

**Release:** `index-source-dependence-v1`

## Finding

The current four-dimension composite combines four separately published products, but it does not combine four independent evidence streams. Every scored observation comes from a third party. Civica normalizes and weights those observations; it does not add a country observation of its own.

The upstream ecosystems overlap. The exact WGI workbook identifies V-Dem (`VDM`), Freedom House (`FRH`), EIU, and Bertelsmann (`BTI`) among its constituent-source fields. The CPI workbook names Freedom House Nations in Transit, EIU Country Ratings, and the Bertelsmann Transformation Index among its sources. Publisher separation therefore overstates information separation.

## Empirical dependence

Across 2,270 complete country-years, pairwise input correlations range from 0.715 to 0.957. The first component explains 87.3% of their level variance, with near-equal loadings. A held-out linear model using the four public inputs reconstructs the Civica score with R² 0.99985. This is expected: the score is a deterministic transformation of those inputs.

Leaving one published input out produces meaningful movement. The 95th-percentile absolute rank shift is 25.2 places without democratic quality, 23 without rule of law, 33.2 without Freedom House, and 10.4 without CPI. These results show dependence on input selection. They do not establish independent corroboration among the inputs that remain.

## What cannot be estimated

A true leave-one-upstream-family-out test is not identifiable from the released aggregates. WGI and CPI do not provide alternate country estimates recomputed after removing V-Dem, Freedom House, EIU, or Bertelsmann. Subtracting a named constituent from an aggregate without the publisher's measurement model would invent data. The release records this result as `not_identifiable_from_published_aggregates`.

## Claim rule

The safe description is: “a Civica transformation of overlapping third-party governance assessments.” Civica must not describe the inputs as four independent sources, call their agreement independent corroboration, or call the composite original country measurement.

This does not decide the final disposition of the Index. It identifies a limit that any hardened version must address through a different construct, genuinely original observations, or much narrower claims.
