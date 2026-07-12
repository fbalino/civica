# PUL-031 migration and repair plan

- Authoritative migration: `0023_wide_gorilla_man`
- SQL hash: `3e561cffdaaeb6ed1a1c42527f97e8775012ba00a87c26d5e2b68ddfcf2efef8`
- Planned statements: 55
- Destructive statements: 0
- Live pre-migration rows: 384 event projections, 1,507 raw reports, 529
  event-source links, 10 pipeline runs, and 62,329 retained history rows
- Pre-migration missing relations: `pulse_incidents`,
  `pulse_incident_assignments`, and `pulse_incident_resolutions`, all created by
  the migration
- Isolated verification: the complete 24-migration authoritative chain applied
  to a fresh PostgreSQL 17 database before the production write
- Checked final public-schema fingerprint:
  `924e70bf4fbd6721becb65ec880fc3ea1f05d864639e983caface871c706fbc1`
- Production result: 24/24 authoritative ledger entries and the exact checked
  fingerprint

The repair itself defaults to a zero-write plan. Application requires the exact
plan key through `--expected-plan-key`; a changed candidate population fails
closed. Confirmed merges retain losing incidents, event projections, sources,
raw evidence, decisions, and synchronous before/after history. Current queries
select one current projection and aggregate evidence across the surviving
incident.
