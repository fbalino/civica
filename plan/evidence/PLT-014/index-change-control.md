# PLT-014 Index change-control classification

The append-only record `closed-release-publication-consistency-contract`
advances the protected product-contract label from
`civica-index-route-io-contract-v31` to
`civica-index-release-consistency-v32`.

The follow-up record `sealed-release-manifest-hash-correction` advances that
label to `civica-index-release-consistency-v33`. It is an **input-only**
correction: the checked source-input manifest was regenerated after the
adapter implementation changed, so the three staged release headers now bind
its new byte hash. Publisher-input hashes and released score values did not
change.

## Categories

- **Input:** exact release selection, source-artifact lineage, release storage,
  and pointer-bound queries replace version inference and mixed-current reads.
- **Transform:** composite derivation records now bind the exact release
  envelope and release-specific algorithm contract.
- **Weight or model:** the historical R3 uncertainty simulation is separated
  from deterministic R4/R5 point estimates; Pulse score publication becomes
  one pointer-bound completed run without changing the disclosed Pulse model.
- **Presentation:** API responses expose release identity, methodology hash,
  supersession, uncertainty, and component freshness; incompatible releases
  fail with a stable noncacheable error.

## What does not change

This task does not recalculate or silently revise the checked R3, R4, or R5
country scores, ranks, or dimension values. The live audit must reproduce the
existing rows against the newly explicit release contracts. The country score
surface removes a retired general-purpose composite representation; dedicated
Index surfaces continue to publish the pointer-selected experimental Index
release.

The owner-controlled color-photo trial and typography tester are excluded from
the protected snapshot and commit. The photo experiment's one watched shared
file is admitted only by an exact known working-copy hash, never by a path-wide
or pattern-wide exemption.

## Rollback rule

Never edit or delete the v32 or v33 record. A rollback or correction that changes a
protected input, transform, model, or presentation file appends a new record
with new evidence and reruns the category-required validators. Published
release rows are immutable; corrections use a new release or an explicit
forward fix.
