# IDX-032 evidence — Measurement Concordance prototype

K2 uses V-Dem LDI, WGI Voice & Accountability, and Freedom House PR+CL as institutionally distinct raters for one broad democratic-accountability construct. Eligibility requires a named publisher and methodology, broad coverage, published observations, an explicit construct mapping, and source-dependence disclosure. Three sources are mandatory.

Each country-year uses exact common coverage and within-year average-rank percentiles. Outputs retain named placements, range, IQR, coverage, split, and an explicit `within_source_uncertainty_not_retained` state. Copy forbids reading agreement as truth, disagreement as poor governance, or the result as country quality.

Panel v3 produces 3,260 private profiles; output SHA-256 is `b99d95495b1b0fb2633e3b960a1e3b13ea7573c569f28b5deced4545300324cf`. Only 1,208 development rows enter diagnostics:

- Midpoint-artifact R²: 0.0983777065, below the preregistered 0.70 ceiling
- Any drop-one-rater tercile change: 0.6564569536, above the preregistered 0.15 stability limit

This is an adverse stability result, not a pass. Validation and final-holdout decision metrics remain sealed. `plan/research/k2-concordance-known-case-protocol-v1.md` preregisters the independent contested/consensus expert set and AUC test; those human labels are pending.

`npm run validate:k2-concordance-prototype:live`, `npx tsc --noEmit`, and all 690 repository tests pass.
