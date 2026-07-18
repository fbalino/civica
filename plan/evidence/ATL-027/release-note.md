# ATL-027 release note

Conditions values now have an immutable release boundary. A release preserves
the reference population and period, included components, missingness policy,
normalization direction and parameters, and the exact calculation identities.
Later values are a successor release; they cannot revise a cited release in
place. This change does not combine Conditions dimensions or make a quality
claim about countries.

Historic scores remain retained but are not converted into frozen releases
without an explicit, verified source run.
