# PUL-040 runtime evidence-cut migration plan

No database or release migration is performed. Regenerate the deterministic
runtime snapshot after updating the checked historical evidence cut, run the
static and read-only live runtime validators, and append the protected
input/presentation change record. The record also rolls forward committed
protected Atlas/API/platform changes made since v48; it is a registry catch-up,
not a data or methodology migration.

Rollback means restoring the prior checked cut only if the live aggregate query
proves the newer date was erroneous. It must not delete retained raw evidence
or imply that the older date is current.
