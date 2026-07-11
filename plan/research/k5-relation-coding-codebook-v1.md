# K5 institutional-relation coding codebook v1

**Frozen:** 2026-07-11 before relation labels or expert verdicts are inspected  
**Method:** `k5-institutional-constraint-map/v1`

## Boundary

K5 describes formal, de jure relations among named institutions. It does not measure whether powers are exercised in practice, whether a system is democratic, or whether more constraints are desirable. There is no weighted total, country score, rank, grade, tier, or traffic light.

Constitute topic tags nominate passages for double-blind coding. A nominated passage is not a graph edge. Unknown endpoints remain unknown, and absence of a tagged passage never means absence of a power.

## Closed candidate taxonomy

The frozen topic-to-relation taxonomy covers selection (`cabsel`, `consel`), removal (`cabdiss`, `conrem`, `hogdiss`, `hosdiss`, `jrem`), legislation approval or veto (`legapp`), veto override (`override`), legislature dismissal (`legdiss`), constitutional review (`conpow`), and emergency power (`em`). Topic semantics may supply a candidate target, but a coder must identify every asserted source and target institution in the passage.

## Blind coding

Two coders independently receive the passage, article label, topic label, constitution year, and this codebook. They do not receive country identity, government-quality data, the other coder's decision, or final-holdout expert labels.

For each passage they record:

1. `relation_present`: yes, no, or cannot determine.
2. `relation_type`: one closed taxonomy value or cannot determine.
3. `source_institution`: exact named institution or cannot determine.
4. `target_institution`: exact named institution or cannot determine.
5. `scope`: ordinary, emergency-only, conditional, mixed, or cannot determine.
6. `exception_note`: the operative threshold, exception, or shared authority in one sentence.
7. `needs_more_context`: yes or no.

Only post-agreement adjudicated rows with named endpoints can become directed graph edges. Parallel or shared powers remain separate edges with their conditions; they are not collapsed.

## Frozen gates

Before adjudication, relation coding must reach Krippendorff's alpha ≥ 0.80. A legal or comparative-institutions expert must judge at least 80% of 30 blinded relations fair. At least 98% of a 100-relation stratified citation audit must be traceable to the displayed passage and source identity. Any weighted total or country-quality output is an automatic failure.

## Current status

The extractor produces a private candidate packet only. Double coding, expert review, and citation audit are pending. Therefore the candidate publishes no graph edges or comparative summaries.
