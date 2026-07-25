# EXP-038 Governance Evidence migration plan

Date: 2026-07-25

No database, data, release, or schema migration is required.

The deployable change is one server-rendered fallback sentence on
`/governance-evidence`. Existing release IDs, publisher citations, dynamic
original-publication timestamps, observations, and rights links remain
unchanged.

Before release, the copy contract, Index quarantine, Index disposition,
Governance Evidence review-packet validator, aggregate claims/docs gate, and
real-route browser checks must pass. A future correction would use a new
append-only Index change record; the existing registry entry is not rewritten.
