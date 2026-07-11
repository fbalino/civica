# Index tournament confirmatory decision

**Release:** `civica-index-tournament-confirmatory-decision-v1`

## Decision

No candidate wins on the evidence currently available. Eight of the 24 frozen thresholds pass, two fail, and 14 remain unresolved because they require qualified readers, coders, or external specialists.

K0, the source-native dashboard, passes file fidelity, provenance, and rights checks. Its reader-comprehension threshold has not been tested. It remains the reference floor and the default if a later decision ends in an unresolved tie.

K1 cannot claim to be an original Civica measurement. A model using its four public inputs reproduces the final-holdout score at R² 0.999847, above the preregistered 0.90 failure boundary. This does not settle the narrower question of whether a derivative summary is useful. That question remains open until the qualified-reader study measures accuracy and completion time. The current league-table presentation also fails the separate misuse audit and cannot be treated as an acceptable default while the study is pending.

K2 passes its midpoint-artifact and minimum-source checks but fails stability: removing one rater changes the final-holdout tercile classification for 63.2% of profiles, against a maximum of 15%. K3, K4, and K5 remain research prototypes because their human coding and external-review evidence does not yet exist.

## Rule application

Every threshold is noncompensating. A strong result on one test cannot cancel a failure or an unresolved required test. The analysis uses no confirmatory p-value family that would trigger Holm adjustment. K1's small changes under near-equal weights do not cancel its much larger source, normalization, and aggregation sensitivity. Missing subgroup performance is recorded as insufficient evidence rather than a pass.

The simplicity rule did not choose a winner because no candidate qualifies. K0 retains the preregistered tie preference for any later unresolved tie.

## Threshold changes

The checked decision file is immutable confirmatory evidence. Any changed threshold or additional result must use a new release labelled `exploratory`. The exploratory scenario helper cannot select a winner or overwrite this result.

## Machine record

The complete 24-row decision table, candidate counts, penalty handling, outcome, and result hash are in `data/releases/index-tournament-confirmatory-decision-v1/decision.v1.json`.
