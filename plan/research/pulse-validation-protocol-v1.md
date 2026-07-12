# Pulse validation protocol v1

**Status:** preregistered; evaluation has not started  
**Locked:** 2026-07-12 12:00 UTC  
**Machine-readable contract:** `data/research/pulse-validation-protocol-v1.json`  
**Runtime at lock:** `pulse-v2.15-beta`

## Purpose

Pulse needs three different kinds of evidence. The ten well-known historical
cases can catch regressions, but their hand selection cannot estimate accuracy.
A retrospective sample can estimate errors on retained production evidence,
including events the system missed. A prospective shadow window can test the
frozen pipeline on evidence that did not exist when the method was locked.

The three lanes remain separate in analysis and reporting. A strong result in
one lane cannot substitute for a missing result in another.

## Lane 1: historical regression fixtures

The ten files under `data/backtest/` remain named regression fixtures. They
exercise taxonomy, direction, severity, parser, and lifecycle behavior for
known shocks. Their current harness calls a legacy single-engine path, so its
result is a software smoke test and not evidence about the production ensemble.

Before Civica makes a current-method claim, the exact frozen production path
from ingestion through publication must process these fixtures. A failed
expectation is a defect. Ten passes supply no population estimate and cannot
promote Pulse out of beta.

## Lane 2: retrospective validity

The frozen period is 2026-04-13 through 2026-07-11. Sampling follows
`pulse-evaluation-sampling-frame/v1`, which was locked before gold-label access.
It contains:

- a census of 384 retained event candidates;
- a 536-unit probability draw from system negatives, targeting 482 valid units;
- a 536-unit probability draw from country-days, targeting 482 valid units.

Independent coding must evaluate retrieval, clustering, jurisdiction
attribution, event existence, category and dimension, severity, abstention,
publication, and observability. The analysis must count spurious extra
dimensions, missed events, retrieval misses, wrong jurisdictions,
deduplication failures, false abstentions, invalid-input handling, and
publication errors. Sampled failures stay in the denominator and the error
ledger.

The event census describes the retained candidate population for the frozen
period. Generalized estimates from the two probability frames require their
declared design weights and variance method. Famous cases are excluded from
all estimation.

## Lane 3: prospective shadow evaluation

The prospective window lasts 90 consecutive UTC days. Its start is not
2026-07-12 by default: PUL-040 must first verify every prerequisite and record
the earliest compliant instant before the first eligible retrieval. The window
then retains every in-scope input, run, attempt, decision, failure, event,
review obligation, and dimensional output from ingest, cluster, classify,
corroborate, review, and score.

Human labels remain unopened until the window and sampling frame are frozen.
After closure, the same label-blind allocator constructs event-candidate,
system-negative, and country-day frames using a seed derived only from the
window identity.

Any semantic change to the source basket, ontology, prompts, model panel,
thresholds, stage logic, or publication rules ends the active window. Continuing
requires a new protocol version and a new window. Dates cannot be extended
after labels are opened to obtain a larger or more favorable sample. An
underpowered result is reported as underpowered. Results and limitations are
reported whether or not the quality thresholds pass.

## Gold labels and analysis boundary

Owner judgments and model outputs are not gold labels. The retrospective and
prospective releases require independent human coding under
`pulse-independent-coding/v1`, with separate adjudication where required.
Model agreement remains a process diagnostic; it is not an accuracy measure.

The evaluation target is the current ensemble and the complete production
pipeline. Component metrics may locate failures, but the headline result must
retain end-to-end retrieval and publication errors. A valid result may be
inconclusive or show that Pulse has no defensible value. The protocol does not
guarantee promotion.

## Start prerequisites

PUL-040 may start the prospective clock only after all of these are true:

1. This protocol and its semantic hash are checked in.
2. The runtime method and every stage version are frozen.
3. Scheduled ingest, cluster, classify, score, and review-SLA routes are enabled.
4. Every automatic stage has one successful run under the frozen current version.
5. Append-only evidence, output-history, and live retention validators pass.
6. Source coverage and observability are snapshotted at the start boundary.
7. No prospective human labels exist.
8. The start instant and planned end date are recorded before the first eligible retrieval.

At lock time the protocol is `preregistered_not_started`. This document records
the evaluation design; PUL-018, PUL-019, PUL-026, and PUL-040 own execution,
metrics, the shadow period, and the start decision.
