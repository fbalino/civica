# Pulse lineage API-contract migration plan

Date: 2026-07-11
Task: PUL-004

No Civica Index data migration is required. The protected files changed because
Pulse and Index endpoints share strict API schema and example registries.

Pulse database migration `0013_real_bromley.sql` creates immutable stage-run
records, links retained rows to explicit legacy identities without assigning
modern versions, and adds write-once lineage guards. Migration
`0014_boring_tana_nile.sql` adds fail-closed version-envelope constraints.
Current Index releases and the Governance Evidence Dashboard retain their
existing contracts and values.

Rollback must not delete run history. Application code may stop exposing the
new Pulse fields only through a separately versioned API change; stored lineage
and legacy identities remain append-only evidence.
