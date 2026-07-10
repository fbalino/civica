# Source precedence and canonical-selection contract

Status: ADOPTED

Version: `source-precedence/v1`

Adopted: 2026-07-10

Implementation: `src/lib/factbook/reconcile/resolver.ts`

## Scope

This contract governs how Civica chooses one displayed country fact from the
eligible observations stored for the same jurisdiction and canonical fact key.
It does not turn a republished value into independent corroboration; claim
lineage is governed by `source-independence.ts` and is included in the decision
trace.

## Ordered rules

1. **Eligibility.** Rejected, superseded, and demoted rows cannot win. An
   active numeric row outside its fact key's plausibility envelope is treated
   as rejected and retained for audit.
2. **Measurement before projection.** If at least one measured observation
   exists, all projections remain alternates and cannot win. Projections form
   the candidate pool only when no measurement exists.
3. **Group A and C incumbent policy.** Identity and narrative/structural facts
   retain CIA wording when an eligible CIA row exists. Disagreement opens a
   reviewable dispute. A missing CIA value can fall through to an eligible
   referenced Wikidata claim or the lowest-tier available row.
4. **Group B freshness.** Fast-changing quantitative facts choose the freshest
   eligible measurement after the two guards below. The freshness ladder is
   `data_vintage_year`, then `as_of`, then `fact_year`, then retrieval time.
   A publisher's republication or forecast label cannot make older underlying
   data fresher.
5. **Equal-vintage precedence.** The country's registered national statistical
   office wins a tie for its own observation. Producing institutions and the
   registered UN direct-access path follow, then downstream republishers,
   compilations, referenced Wikidata, and the frozen CIA archive. A stable
   source-ID comparison breaks any tie that remains, so database row order can
   never decide the canonical value. This rule does not claim that all sources
   measure identical constructs.
6. **Material-error guard.** A challenger beyond the fact key's registered
   unit or percentage-point threshold is retained as a proposed dispute and
   cannot replace the incumbent without review.
7. **Reference-quality guard.** A Wikidata claim must cite at least one
   allow-listed upstream publisher. Wikidata is a structured path, not the
   producing institution. Direct ingesters are admitted only through their
   registered adapter/source contract.
8. **Comparability exception.** For real GDP growth, an annual year-on-year
   observation is preferred to a non-comparable quarterly/accumulated basis
   unless the latter is more than twelve calendar months fresher.
9. **Republication disclosure.** The selected source ID and its producing
   family are both reported. World Bank, UN Data, UNDP, Eurostat, and other
   republisher relationships do not create an extra independent family.

## Decision trace

Every resolver selection emits ordered `decisionTrace` steps for row
eligibility, measurement/projection partition, source lineage, precedence,
guards, and final selection. The final step records the chosen source, value
type, effective vintage basis, and this contract version. Public provenance
objects carry the same trace.

## Change rule

A change to ordering, tie priority, freshness basis, guard threshold semantics,
or trace meaning requires a new contract version, updated fixtures, current
methodology prose, and a release/vintage decision. Adding a source under an
existing rule does not by itself change this contract.
