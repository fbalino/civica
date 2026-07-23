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
7. Exercise the real correction authority: create an incident/correction
   record and the matching status/changelog evidence without notifying real
   subscribers.
8. Resume jobs only after every recovery check passes and Fernando signs off.

All twelve closed check IDs in the JSON record must pass with evidence. The
record rejects a `complete` status without a deliberate bad release, recovery
identities, correction/status/changelog records, and dated owner sign-off.
