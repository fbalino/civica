# QA-017 — Index change-control migration plan

Date: 2026-07-18

## Database impact

None. This record reconciles checked source and public-contract hashes; it
does not apply a database migration, write a release, or modify a live score.

## Control-plane action

1. Classify the two restricted analysis-input modules as Index inputs.
2. Append the current protected snapshot to the immutable registry.
3. Run all category-required validators and the version-specific Pulse
   recovery suite.
4. Rerun QA-017 from a clean worktree before treating its checklist item as
   complete.

## Rollback

The registry is append-only. If the controlled snapshot is found to be wrong,
append a correcting record; do not edit this one or restore a prior snapshot.
