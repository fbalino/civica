# PLT-014 migration and publication plan

This file defines the compatibility boundary proved by PLT-014. PLT-019 owns
the later production staging rehearsal, operator runbook, deploy execution, and
rollback drill.

## Preconditions

1. Verify the authoritative migration history and public-schema fingerprint.
2. Verify the checked source-input and raw-retention manifests, then confirm
   every staged R3/R4/R5 header uses their exact input-manifest byte hash.
3. Apply `0036_moaning_toad_men.sql` on staging and rerun the release validator.
4. Reproduce R3, R4, and R5 semantic/storage hashes from the staged database.
5. Run the Index publication command in explicit `--stage`, `--check`, then
   `--publish` modes for each registered release in predecessor order.
6. Confirm the current Index pointer selects R5 and the Pulse pointer selects
   one completed, complete five-dimension run before deploying readers that
   require the new tables.

## Compatibility rules

- The migration adds release headers, release IDs, pointers, validation
  functions, and immutability triggers without dropping legacy score columns.
- Existing Index rows are bound to one registered release; no methodology and
  quarter pair is treated as a release identity by itself.
- Applying the migration stages Index headers only. It never equates migration
  success with publication and never moves the production Index pointer.
- Pointer changes are atomic with database-side invariant checks. Published
  score/history/header rows cannot be updated or deleted.
- Application readers fail closed if a required table, pointer, complete panel,
  lineage record, or hash is absent. They do not fall back to current mutable
  rows.

## Abort points

- Stop before application deployment if migration/fingerprint checks fail.
- Stop before pointer publication if any exact reproduction, source lineage,
  completeness, uncertainty, supersession, or predecessor check fails.
- Stop before reader deployment if representative Index and Pulse endpoints do
  not resolve one internally consistent release.

## Rollback and correction

Keep the additive schema in place during an application rollback. Pointer
deletion and mutation around the publication function are prohibited, so a bad
published release is corrected with a reviewed successor/forward fix rather
than destructive row edits. A schema rollback must be separately designed and
rehearsed under PLT-019; it is not implied by this task and must not remove
evidence-bearing published rows.

The v34-evidence control amendment makes no schema, migration, pointer, or
publication change. It only preserves the authenticated evidence trail for the
already-defined PLT-014 boundary.

The v35-evidence amendment validates that evidence-only refreshes cannot reuse
stale evidence roles; it also makes no schema, migration, pointer, or
publication change.
