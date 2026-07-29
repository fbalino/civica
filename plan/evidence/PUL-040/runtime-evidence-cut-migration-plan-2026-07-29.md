# PUL-040 runtime evidence-cut migration plan — 2026-07-29

No database or data migration is performed. Update the checked historical
evidence cut, regenerate the deterministic runtime snapshot, run the static
runtime validator, and append the protected presentation change-control
record. The separate PUL-040 prospective-start audit remains unchanged until it
is rerun through the guarded read-only production path.

A later authorized deployment may publish this application-only correction
after the exact candidate passes its change-control, claims, and build gates.
It does not authorize a production pipeline or score run.

Rollback means shipping a reviewed forward correction and appending new
change-control evidence. Restore the prior checked cut only if a read-only
production aggregate proves 2026-07-29 was erroneous. Never delete retained
evidence or imply that an older cut is current.
