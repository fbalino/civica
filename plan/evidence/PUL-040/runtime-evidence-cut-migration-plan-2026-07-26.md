# PUL-040 runtime evidence-cut migration plan — 2026-07-26

No database or data migration is performed. Regenerate the deterministic
runtime snapshot after updating the checked historical evidence cut, regenerate
`start-readiness.json` from the verified Vercel production environment, run the
static and read-only live validators, and append the protected change-control
record.

The Pulse timing correction is application code only. A later authorized
deployment may publish it normally after the exact candidate passes the
staging, change-control, claims, and build gates. It does not authorize a
production score run.

Rollback means shipping a reviewed forward application correction and appending
new change-control evidence. Restore the prior checked evidence cut only if a
read-only production aggregate proves 2026-07-26 was erroneous. Never delete
retained evidence, rewrite terminal pipeline runs, or imply that an older cut
is current.
