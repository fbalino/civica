# K2 Measurement Concordance known-case protocol v1

## Purpose

This external-validity test asks whether K2 separates country-years that independent comparativists identify in advance as contested across measurement projects from cases they identify as broad consensus. It does not ask experts to endorse Civica's computed values.

## Case assembly

At least three comparativists with governance-measurement or comparative-regime expertise independently nominate cases from published methodological disputes, country coding notes, or documented cross-index divergence. They do not see K2 output. A case enters the contested set only with a citation and agreement from two nominators; consensus cases require an explicit published basis or agreement from all three. The final frozen set contains at least 20 contested and 20 consensus jurisdiction-years, balances regions and score levels where possible, records conflicts, and excludes any case used to design K2.

Agents may search, deduplicate, check citations, and prepare a blinded packet. Agent or model votes cannot supply the expert labels.

## Locked evaluation

The primary statistic is AUC for K2 spread distinguishing contested from consensus cases. K2 must reach at least 0.80 and exceed both midpoint-distance and retained V-Dem-uncertainty-width baselines by at least 0.05. If upstream V-Dem uncertainty is still unavailable, that baseline is reported as not estimable and cannot be counted as beaten. Confidence intervals use a stratified bootstrap with a fixed seed declared in the final evaluation package.

The expert set remains sealed until K2's method and development choices are frozen. Validation and final tournament holdouts cannot be used to select cases, thresholds, rater membership, or presentation.

## Interpretation and retirement

Passing does not establish that rater agreement is truth. Development already shows substantial leave-one-rater fragility; a known-case pass cannot compensate for a failed required stability gate. Failure twice under the charter retires the highlighted concordance summary. Named source placements can remain part of the no-score dashboard if their own fidelity and rights gates pass.
