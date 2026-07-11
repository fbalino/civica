# Civica Index candidate tournament preregistration v1

**Registered:** 2026-07-11T09:17:44Z

**Status:** Locked before winner-selecting analysis

**Machine contract:** `src/lib/ci/tournament-preregistration.ts`

## Frozen inputs

The protocol pins the 2000–2024 research panel and its row, coverage, and temporal-break hashes; the charter, candidate-set, and panel commits; all six K0–K5 candidates; and the six B0–B5 baselines. Exact values remain private under the panel's mixed-rights posture. Aggregate results may be published only after their own rights review.

## Splits

Panel time is divided into development (2000–2016), validation (2017–2020), and final holdout (2021–2024). Countries are independently assigned by the first unsigned 32 bits of `SHA-256("civica-index-geographic-holdout-v1:" + ISO3)`, modulo ten: buckets 0–6 develop, 7–8 validate, and 9 is final holdout. Outcomes play no role in assignment.

Fact, pairing, and structure candidates use the same country folds. Their event evidence is split at the end of 2020 and 2022. Later evidence may verify a citation but cannot become an input feature for an earlier holdout event. Final-holdout metrics stay sealed until candidates and parameters are frozen from development and validation data.

## Baselines

- B0: source-native dashboard/no score, applicable to every candidate's claimed reader value
- B1: strongest single established indicator for coherent judgment tasks
- B2: transparent equal-weight common-scale average
- B3: first common factor where a latent summary is coherent
- B4: midpoint distance and source count for Measurement Concordance
- B5: latest eligible public structured dataset for fact, pairing, and structure work

Every candidate receives the same applicable split and baseline. A more complex method cannot survive merely by looking interesting.

## Required gates

Six gates govern every disposition: incremental information or reference fidelity; reliability and stability; external or known-case validity; coverage and missingness; interpretation and misuse resistance; and reproducibility, rights, and sustainability. All applicable gates must pass. Strong performance on one gate cannot cancel a failure elsewhere.

The machine contract freezes candidate-specific thresholds. Highlights include 100% file fidelity for K0; an explicit information-novelty test and meaningful reader-task improvement for K1; artifact, source-deletion, and known-case tests for K2; reliability, historical agreement, citation, and freshness thresholds for K3; blinded coding and scholar-review thresholds for K4; and relation-coding, expert-review, citation, and no-total thresholds for K5.

K1 receives two distinct decisions. It cannot be called original measurement if its public inputs reproduce it at the frozen threshold. It may remain a bounded, clearly derivative beta only if it still produces meaningful reader utility and passes every reliability, coverage, misuse, rights, and reproduction gate. This keeps hardening open without relabeling arithmetic as new information.

## Missingness, exclusions, and subgroups

No imputation, carry-forward, nearest-year fill, or freshest-value substitution is allowed. Candidate-specific publication thresholds remain frozen. Every exclusion is logged and counted. Missingness and performance are reported by region, income, regime taxonomy, media environment, small-state status, disputed status where in scope, data availability, and source count. Any candidate that turns evidence scarcity into a worse quality estimate fails.

## Sensitivity and multiplicity

Required sensitivity checks vary sources and source families, vintages, normalization, parameters, aggregation, missingness thresholds, uncertainty and covariance assumptions, outliers, time windows, geographic folds, and coding-rule edge cases. Confirmatory hypotheses within a candidate-gate family use Holm familywise correction at 0.05. Exploratory work is labelled separately and uses Benjamini–Hochberg FDR at 0.05; it cannot select a winner.

## Decision rule

Original measurement requires every applicable gate to pass on both temporal and geographic final holdouts. K0 can ship as a reference product after its fidelity, provenance, comprehension, rights, and sustainability gates. A candidate with external evidence still pending may remain experimental only under the narrower contract recorded in the machine specification. A required failure retires the claimed product form. When candidates are practically tied, the simpler, easier-to-understand option wins; unresolved ties go to K0. No candidate winning is an allowed result.

## Amendments

Any change creates a new protocol version and decision record before affected analysis. The original stays immutable. Results using a changed protocol are exploratory unless another untouched holdout exists.
