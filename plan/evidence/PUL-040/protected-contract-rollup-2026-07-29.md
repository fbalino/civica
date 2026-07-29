# PUL-040 protected-contract rollup — 2026-07-29

The append-only Index registry currently ends at v55. This v56 candidate binds
one protected `presentation` change:

- `src/lib/pulse/v2/runtime-contract.ts`.

The change advances only the historical observed-evidence cut from 2026-07-26
to 2026-07-29. A read-only production runtime validator confirmed the newer
`raw_events` date without finding source-ID drift. The generated runtime
snapshot, method version, source roles, operating-feed contract, event
membership, scoring, decay, dimensions, and public-status rules are otherwise
unchanged.

This record does not update the PUL-040 prospective-start audit, prove a
successful automatic-stage run, authorize deployment, or start the 90-day
window.
