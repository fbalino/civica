# Pulse representative evaluation sampling preregistration v1

**Contract:** `pulse-evaluation-sampling-frame/v1`

**Frozen:** 2026-07-11, before gold-label access

## Question and estimands

The evaluation will estimate how the frozen Pulse pipeline performs on documented governance-event detection, exclusion, retrieval, clustering, attribution, labels, severity, abstention, and publication decisions during the fixed 2026-04-13 through 2026-07-11 period. Accuracy on these frozen items and accuracy generalized to comparable future items are separate estimands. The first is a property of this benchmark. The second requires design weights and an analysis that accounts for sampled items and repeated countries.

## Three frames

1. **Retained event-candidate census.** Code all 384 distinct event clusters present at the population freeze, including unpublished and rejected rows. A census avoids sampling error for this finite-period event-candidate benchmark. It does not establish performance in another period.
2. **System-negative probability frame.** Draw 536 retained exclusion or unresolved-raw candidates outside the event census and require at least 482 valid double-coded cases. Candidate state is the primary stratum. This frame covers duplicates, non-events, insufficient evidence, invalid inputs, cluster-level refutations, and unresolved raw candidates. Event-level rejections and refutations stay in the event census so no unit enters two frames.
3. **Country-day retrieval probability frame.** Draw 536 sovereign-country-days and require at least 482 valid double-coded cases. Continent by calendar month is the primary stratum. PUL-015 must attach the source documents and search traces needed to decide whether the day contains an eligible event, a true negative, a retrieval miss, or insufficient observation.

Famous historical shocks remain regression fixtures. They cannot replace, augment, or tune the probability samples.

## Sample-size rationale

For a binary proportion, the conservative planning value is 0.50. A two-sided 95% normal approximation with an absolute half-width of 0.05 requires `ceil(1.96² × 0.5 × 0.5 / 0.05²) = 385` independent cases. The probability frames inflate this to 482 valid cases using a planning design effect of 1.25, then to an initial draw of 536 for up to 10% unusable evidence. The observed design effect replaces the planning value in analysis. Exact or Wilson-style intervals and survey-aware variance estimates will be reported as appropriate.

This follows the precision logic used for sensitivity and specificity planning in [Buderer (1996)](https://pubmed.ncbi.nlm.nih.gov/8870764/). CDC guidance requires selection weights and design-aware variance when probabilities differ or observations cluster ([weighting](https://wwwn.cdc.gov/nchs/nhanes/tutorials/weighting.aspx), [variance estimation](https://wwwn.cdc.gov/nchs/nhanes/tutorials/varianceestimation.aspx)). NIST AI 800-3 distinguishes accuracy conditioned on a fixed benchmark from accuracy generalized beyond sampled items; the analysis must state which one it estimates ([NIST AI 800-3](https://doi.org/10.6028/NIST.AI.800-3)).

## Balance and selection

Primary strata determine the initial draw fractions and base weights. Separate marginal constraints balance continent and jurisdiction, month and week, language including `und`, specialist/news/none source type, BR/CGV regime class including unclassified, and the retained media-evidence environment. The latter distinguishes country-days with five or more documents from two or more source families, observed days below that threshold, and days with no retained documents. Because deterministic margin repair deliberately changes the evidence-environment mix, the main analysis calibrates the base weights to the frozen population totals and reports unweighted and uncalibrated-base-weight sensitivity estimates. Political media context remains a separate missing field until a rights-cleared sourced record exists. Evidence density is not treated as press freedom or country quality.

The full cross-product is not required because many cells are structurally sparse. A reportable margin targets at least 30 valid cases when the population permits; smaller cells are pooled only under a predeclared substantive grouping or reported as insufficient evidence. The allocator applies bounded minima and largest remainders within primary strata. Units are ordered by SHA-256 of the frozen seed, frame, stratum, and unit id. Replacements take the next reserve in the same primary stratum.

Each probability-sampled case carries its selection probability, primary stratum population and sample counts, inverse-probability weight, reserve rank, and all balance tags. Analysis retains the complete frame and uses a subpopulation indicator rather than deleting unsampled or out-of-subgroup rows.

## Prohibited changes

No label, model-correctness judgment, owner approval, famous-case outcome, or early result may affect selection. Sampled failures cannot be dropped. A change to dates, eligibility, strata, quotas, seed, replacement, weights, or estimands requires a new version recorded before new labels. The old protocol and adverse results remain available.

## Dependencies and boundary

PUL-014 freezes the design. PUL-015 builds the no-event and low-observability evidence packets. PUL-016 defines independent coding. PUL-017 implements blind double coding. PUL-018 and PUL-019 execute and report the evaluation. No metric in this preregistration is a validation result.
