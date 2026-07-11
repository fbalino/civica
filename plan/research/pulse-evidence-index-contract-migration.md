# Pulse evidence API-contract migration plan

Date: 2026-07-11
Task: PUL-005

No Civica Index data migration is required. Pulse and Index endpoints share
strict API schema and example registries, so the new Pulse evidence response
crosses the Index presentation change-control boundary without changing Index
semantics.

Authoritative database migration `0015_steep_cyclops.sql` backfills and seals
the Pulse evidence identities. Existing payloads stay private, retained rows
keep explicit legacy hash and attribution methods, event-source links become
required, and all public payload redistribution remains blocked.

Rollback must not delete evidence or remove event-to-raw links. A later API
shape change requires its own versioned contract; the stored evidence identity
remains append-only.
