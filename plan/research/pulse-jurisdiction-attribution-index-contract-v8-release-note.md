# Pulse jurisdiction-attribution shared-contract v8 release note

**Contract version:** `civica-index-api-contract-pulse-jurisdiction-attribution-v8`

The Pulse runtime method is now `pulse-v2.8-beta`. Subject attribution uses
`pulse-jurisdiction-attribution/v2` with a content-hashed
`pulse-jurisdiction-entities/v1` catalog and
`pulse-jurisdiction-aliases/v1`. The model receives human-readable entity
context and returns one primary jurisdiction plus any materially affected
jurisdictions, each with a rationale and headline/description evidence
references. Unknown, supranational, or primary-less cases remain unresolved
and cannot publish automatically.

The country-events API now exposes the requested jurisdiction's role and may
return an event for an affected jurisdiction. Only the primary role feeds the
current experimental country projection. Retained history is identified as a
legacy single-jurisdiction projection rather than being relabeled as a v2
decision. Index calculations and the source-native Governance Evidence
Dashboard are unchanged.
