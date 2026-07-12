# PUL-035 — dimensional score expiry and history

Verified on 2026-07-12.

Pulse recomputation now evaluates the union of jurisdictions represented by
eligible events and jurisdictions with an existing dimensional projection. An
event dated exactly 365 days before the score date remains eligible. An event
dated 366 days before it does not. Future-dated events do not enter a score.

When a jurisdiction has no eligible event, the scorer writes five internal
zero tombstones with empty contributor lists. Public country-dimension reads
return `null` for those dimensions and do not describe the absence as
stability.

Migration `0027_smart_tempest` added explicit score dates and window metadata
to the current projection and created append-only
`pulse_dimensional_delta_history`. Every score run writes one history row and
one current projection per jurisdiction and dimension, then completes the run
in the same database batch.

Production holds 325 current rows for 65 jurisdictions and 650 immutable rows
across two score runs. The current set has 98 nonzero rows, no nonzero row
without an eligible event, and no current/history mismatch. The current run is
`ded03ccb-c793-4b57-b1a3-1a6e88e71377`.

See [migration-plan.md](migration-plan.md) for the database rehearsal and
[verification.md](verification.md) for the final gate results.
