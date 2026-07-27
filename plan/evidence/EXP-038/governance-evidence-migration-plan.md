# EXP-038 Governance Evidence migration plan

Date: 2026-07-26

No database, data, release-row, or schema migration is required.

The deployable protected change is one server-rendered fallback sentence on
`/governance-evidence`. It changes no publisher value, scale, source input,
harmonization rule, route, API shape, or rights condition.

The change is appended to the Index change-control ledger from its current
Main-aligned head. Rollback is a source revert plus a new append-only record;
the existing registry entry is never rewritten.
