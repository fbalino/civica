# Civica Index candidate specifications v1

**Adopted:** 2026-07-11

**Contract:** `civica-index-candidate-set/v1`

**Governing charter:** `civica-original-measurement-charter/v1`

## Purpose

This candidate set turns the earlier design-space review into six testable product hypotheses. They differ in what they claim and what they observe. A new weighting scheme does not count as a new candidate. The TypeScript registry in `src/lib/ci/candidate-specifications.ts` is the field-complete source for inputs, transformations, missingness, uncertainty, versioning, normative choices, expected value, presentation, validation, and retirement.

| ID | Candidate | Kind | Primary unit | Core claim |
|---|---|---|---|---|
| K0 | Governance Evidence Dashboard | No-score reference | Jurisdiction–indicator–period | Named publishers report these native-scale observations. |
| K1 | Hardened Four-Input Composite | Derivative benchmark | Jurisdiction–period estimate | A versioned weighted summary represents the four named upstream judgments. |
| K2 | Measurement Concordance | Meta-measurement | Jurisdiction–construct–year rater profile | Eligible raters agree or disagree by the reported amount. |
| K3 | Power and Transfer Ledger | Institutional fact ledger | Event plus current institutional state | Cited events and rules establish the recorded transfer, tenure, or term-limit state. |
| K4 | Constitution-to-Practice Pairings | Evidence pairing | Jurisdiction–commitment–period | Constitutional text and an external practice observation can be fairly shown together. |
| K5 | Institutional Constraint Map | Institutional structure | Jurisdiction–institution relation | Sources assign a named formal power or constraint between institutions. |

## K0 — Governance Evidence Dashboard

K0 manufactures no Civica measurement. It shows established indicators on native scales with publisher ownership, definitions, direction, vintage, missingness, retained upstream uncertainty, and citations. No average or country verdict is permitted. It is the floor product and the no-score baseline for every claim of added value. Fidelity or rights failure removes the affected source row rather than substituting another source.

## K1 — Hardened Four-Input Composite

K1 is the current Index's strongest fair tournament form, not the preferred outcome. It uses the four frozen judgment indicators, versioned transforms and aggregation, the existing explicit missingness rule, and source-specific uncertainty only when it can be retained and modeled with dependence. It must beat the single-source, equal-weight, factor, and dashboard baselines on a preregistered reader task. Failure of information novelty or meaningful utility retires it. A different input construct would be a new candidate.

## K2 — Measurement Concordance

K2 measures the measurement ecosystem. Within a named construct and common coverage set, it compares at least three eligible raters using percentile placement, range, IQR, and drop-one-source stability. It keeps within-source uncertainty separate from between-source dispersion. Agreement is not truth, and disagreement is not evidence of poor governance. Midpoint artifacts, source-set fragility, expert known-case validity, and reader misinterpretation can each kill the candidate.

## K3 — Power and Transfer Ledger

K3 records executive tenure, electoral transfers, alternation, and term-limit states as dated facts. A versioned rulebook handles parties, coalitions, indirect selection, interim leaders, collective executives, and disputed transitions. Incomplete histories show their record start and never imply that no transfer occurred. The output is a cited timeline and fact table, with no score. Reliability, historical overlap, citation traceability, and freshness determine whether derived states survive.

## K4 — Constitution-to-Practice Pairings

K4 joins a small, preregistered set of constitutional commitments to semantically matched external practice indicators. The constitutional text and externally owned observation remain separate. No subtraction, hypocrisy label, gap rank, or composite is allowed. Mapping reliability, qualifier and exception handling, and blinded constitutional-scholar review determine which commitment families may be shown.

## K5 — Institutional Constraint Map

K5 maps formal appointment, removal, veto, dissolution, term, review, emergency, and reserve-power relations among institutions. It uses a closed relation taxonomy and a directed graph, while keeping unknown relations unknown. Formal authority is not effective practice, and more formal constraints are not treated as better. Double coding, external taxonomy comparison, expert legal review, graph invariants, and citation traceability determine whether relations or summaries survive.

## Tournament boundary

K0 may ship as a reference product after fidelity, provenance, and rights checks because it makes no original measurement claim. K1–K5 remain research hypotheses. IDX-010 will freeze their exact protocols and thresholds before winner-selecting analysis. IDX-013 and the named prototype tasks own implementation. None may appear as a recommended country judgment before the tournament and external-review gates pass. No candidate winning remains an acceptable result.
