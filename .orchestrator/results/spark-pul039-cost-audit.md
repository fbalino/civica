**PUL-039 audit (repository facts + planning assumptions only)**

## 1) Frozen frame counts (exact)

From frozen protocol/data artifacts:

- `retained_event_candidate_census`: initial 384, valid/codable 384
- `system_negative_probability`: initial 536, valid/codable 482
- `country_day_retrieval_probability`: initial 536, valid/codable 482
- Total initial across frames: 1,456
- Total valid/codable across frames: 1,348

(Protocol constants are also repeated in sampling codepaths and protocol JSON artifacts; the frozen population file shows the same census, unresolved/system-negative, and country-day population counts.)

## 2) Low/base/high double-coding workload (coding pass time)

Assumption used: double coding means 2 independent coders per valid packet (no label visibility).

| Scenario | Minutes per packet | Coder-hours (double-coded valid packets) | Formula |
|---|---:|---:|---|
| Low | 12 | 539.2 | 1348 × 2 × 12 / 60 |
| Base | 18 | 808.8 | 1348 × 2 × 18 / 60 |
| High | 30 | 1,348.0 | 1348 × 2 × 30 / 60 |

Frame-level base split:
- Census (384 valid): 230.4 coder-hours
- System-negative (482 valid): 289.2 coder-hours
- Country-day (482 valid): 289.2 coder-hours

## 3) Adjudication assumptions (must be explicit)

These are **planning assumptions**, not measured in repo.

- Disagreement rates:
  - Low/base/high: 10% / 20% / 35% of valid packets
- Adjudication time per conflicted packet:
  - Low/base/high: 8 / 12 / 20 minutes

Resulting adjudication hours:
- Low: 17.9 (≈18.0)
- Base: 53.9
- High: 157.9

## 4) Training, qualification, PM, contingency assumptions (explicit)

- Training/qualification (assumed):
  - Low/base/high: 16 / 24 / 30 hours (coders + adjudicator calibration + compliance review)
- Project management / governance overhead (assumed):
  - Low/base/high: 20 / 25 / 40 hours
- Contingency reserve (assumed):
  - Low/base/high: 10% / 15% / 20% on total planned labor

Total-hour totals with assumptions:
- Low: 652.5 hours
- Base: 1,049.5 hours
- High: 1,891.1 hours

## 5) USD cost scenarios (3+ defensible options)

Using base workload totals (1,049.5 h after contingency) and role-specific rates:

| Scenario | Coder rate | Adjudicator rate | PM rate | Total cost |
|---|---:|---:|---:|---:|
| Low | $40 | $55 | $45 | $43,264 |
| Base | $65 | $95 | $80 | $70,927 |
| High | $100 | $150 | $130 | $109,497 |

Notes:
- These totals use base workload assumption above and allocate fixed role-hours as:
  - Coder (incl. training): 832.8 h
  - Adjudicator (incl. training): 57.9 h
  - PM: 25 h
  and then apply 15% contingency.

(If you want, I can also provide a blended-rate version across a single labor rate.)

## 6) Role separation and qualification recommendation

Keep strict separation and independence:
- 2 coders per packet, independent and blind to each other’s labels.
- 1 adjudicator (or pool) for conflict resolution; adjudicator must not have coded those same packets.
- Adjudicator may participate in calibration but must not submit any primary labels.
- No direct overlap with source-pipeline engineers, model owners, or ingestion operators.
- Mandatory role locks in workspace and immutable codebook/version stamping.
- Qualification criteria: protocol quiz + small synthetic calibration batch + bilingual/interpretable language skill checks + conflict-of-interest declaration.

## 7) Sourcing-pool categories for independence + language/region coverage

Use role-agnostic, non-identifying pools:

- External political-method/vernacular analysts (not civica staff), screened for conflict declarations.
- Bilingual/regional legal-policy coders by language stratum (EN/ES/PT plus other needed language groups).
- Separate adjudicator pool from coder pool, ideally different orgs/teams.
- Geography-balanced recruitment: Americas, Europe, Africa, Middle East/North Africa, Asia, Oceania coverage aligned with quota constraints.
- Include an “undetermined language / multilingual proxy” reserve pool to avoid forcing misclassification when source language is missing.

## 8) Risks controller should catch

- Arithmetic risk: confusion between `initial` vs `valid` and inclusion of `reserve` packets as must-code units.
- Feasibility risk: only country-day coded-artifact evidence is concretely present; verify whether other two frame artifacts are already packetized or require additional packet-construction work before costing is final.
- Leakage risk: any accidental exposure of model owner/correctness fields, famous-case context, or adjudicator labels to coders.
- Independence risk: coder/adjudicator overlap across frames, or overlap with previous sample handlers.
- Statistical risk: no measured inter-coder reliability from this frozen evidence; pilot disagreements in protocol notes are not a production-quality reliability estimate.
- Data-quality risk: `retained`/`country-day` definitions differ; coding guide must pin exact label semantics to prevent drift.

## Repository/plan evidence used

- [plan/00-mission-and-operating-rules.md](/Users/fernandobalino/Projects/civica/plan/00-mission-and-operating-rules.md)
- [plan/05-pulse-event-ledger-and-validation.md](/Users/fernandobalino/Projects/civica/plan/05-pulse-event-ledger-and-validation.md)
- [plan/evidence/PUL-014/README.md](/Users/fernandobalino/Projects/civica/plan/evidence/PUL-014/README.md)
- [plan/evidence/PUL-015/README.md](/Users/fernandobalino/Projects/civica/plan/evidence/PUL-015/README.md)
- [plan/evidence/PUL-016/README.md](/Users/fernandobalino/Projects/civica/plan/evidence/PUL-016/README.md)
- [plan/evidence/PUL-017/README.md](/Users/fernandobalino/Projects/civica/plan/evidence/PUL-017/README.md)
- [data/research/pulse-evaluation-sampling-protocol-v1.json](/Users/fernandobalino/Projects/civica/data/research/pulse-evaluation-sampling-protocol-v1.json)
- [data/research/pulse-evaluation-frame-population-v1.json](/Users/fernandobalino/Projects/civica/data/research/pulse-evaluation-frame-population-v1.json)
- [src/lib/pulse/v2/evaluation-sampling.ts](/Users/fernandobalino/Projects/civica/src/lib/pulse/v2/evaluation-sampling.ts)
