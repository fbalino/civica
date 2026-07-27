# PUL-031 — stable incidents and duplicate repair

PUL-031 replaces run-local Pulse clustering with a stable incident identity.
New reports are compared with recent persisted incidents as well as the current
batch. Exact full identities may merge inside the 48-hour window. Exact
normalized headlines may also merge when the resolved country, calendar date,
and classification labels agree. Semantic and strong-anchor lexical matches
remain separate review candidates.

The authoritative migration adds three evidence-bearing relations, assigns
retained clustered reports and event projections to incidents, quarantines the
one retained blank headline, and enforces one current event projection per
incident. Assignments and resolution findings are append-only; prior event,
decision, source, and raw-report rows remain retained.

The checked zero-write repair plan is `repair-dry-run.json`. It compared 1,106
active incidents across 609,960 pairs, selected five high-confidence duplicate
pairs, retained 13 weaker collision candidates, and performed no writes. The
plan key is
`pulse-incident-resolution/v1/plan/sha256:fb8805985a8c9669e88e194266e0020c7eae91867c15db03be87adc3326465e2`.

`repair-apply.json` records the hash-pinned application and the new
corroboration and dimensional-score run IDs. `migration-plan.md` records the
schema and production preflight. The full test and public-claims gates are
recorded in `verification.md`.
