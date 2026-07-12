# PUL-038 migration plan

`npm run db:plan -- --id=0029_whole_dazzler --live` reported 33 statements,
zero destructive statements, and zero writes. Before application, production
held 384 Pulse v2 event projections and none of the three new relations.

The migration creates release, complete-coverage, and event-pin relations;
adds update/delete rejection triggers; backfills each existing event with an
explicit historically unrecoverable pin; and adds the future event-insert pin
trigger. It does not alter the legacy scalar or any event classification,
publication, corroboration, or score.

The complete authoritative chain replayed on an empty PostgreSQL 17 database.
It produced 76 public tables and all four information-environment triggers.
Production then advanced from 29/29 to 30/30 authoritative migrations with
schema fingerprint
`c9394bb5117cc317a599da21847fd11c0621c6f51fb30670b983ded61a5bffe7`.

Recovery uses the isolated pre-change backup or a reviewed forward
compensation. The new evidence relations are append-only and must not be
reversed in place.
