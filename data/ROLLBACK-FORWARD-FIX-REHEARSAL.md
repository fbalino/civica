# Rollback, forward-fix, and correction rehearsal

**Contract:** `civica-rollback-forward-fix-rehearsal/v1`
**Task:** QA-019
**Current status:** pending external authority

The canonical run record is
`data/rollback-forward-fix-rehearsal.v1.json`. This drill runs only after an
isolated QA-018 staging environment exists. It must never seed a defect in
production or modify frozen/retained research evidence.

## Harmless deliberate defect

Choose one deterministic staging-only defect that is visible to the smoke
suite and reversible without data loss. Preferred fixtures are a wrong cache
header on a fixture route, a mismatched staged asset/version marker, or a
fixture-only release pointer rejected before publication. Do not use a real
credential, restricted payload, destructive migration, or fabricated country
fact.

## Required sequence

1. Deploy the deliberately defective staging candidate and record its exact
   commit/deployment identity.
2. Detect it through the declared smoke/consistency check.
3. Disable jobs, contain staging traffic, and preserve bounded evidence.
4. Choose Vercel Instant Rollback only when the prior reader deployment is
   compatible with the additive schema. Otherwise ship a reviewed forward fix.
5. Keep evidence-bearing schema/data in place; never reverse migrations or
   delete a frozen release to make the drill pass.
6. Verify application, data, cache, artifact, and version identities.
7. Exercise the real local correction path: create an incident/correction
   record and retain the matching changelog without notifying real subscribers
   or fabricating an external status record.
8. Keep jobs quiesced after technical verification. Resumption remains a
   separate production action after Fernando signs off.

All twelve closed check IDs in the JSON record must pass with evidence. The
record has three fail-closed states:

- `pending_external_authority` contains no run evidence and retains the
  staging-authority blocker.
- `run_complete_pending_owner_signoff` retains a completed isolated technical
  run only when all twelve checks pass with evidence; the deliberate bad
  release, exact staging and recovered commit/deployment identities, defect fixture, recovery
  mode, incident/correction record, and local changelog are present. The
  external `statusRecordId` and owner sign-off must remain null, the blocker is
  `owner_status_record_and_post_run_signoff`, and the manual review list must
  explicitly preserve both the status-record and Fernando review.
- `complete` additionally requires a real external status record, no blocker,
  and Fernando's dated sign-off.

The intermediate state does not claim QA-019 is complete and does not authorize
subscriber notification. It records only the technically agent-executable
work while preserving the external publication and owner-decision boundary.
