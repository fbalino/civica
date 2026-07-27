# PUL-036 verification

Verified on 2026-07-12.

## Stored agreement

- The focused suite passed 29 tests. It covers three-provider unanimity,
  one-run rejection, duplicate-provider rejection, mixed-prompt rejection,
  retained legacy evidence, unconditional single-engine review, and direct
  rejection of one-run automatic publication before database access.
- The production writer re-derives agreement from stored runs and rejects a
  caller-supplied mismatch. Static validation rejects literal supported labels
  in classification, subscription, incident-repair, reattribution, and admin
  writer paths.
- The live validator examined all 384 events. Stored derivation matched every
  agreement value, no unsupported automatic publication remained, and all 13
  currently published rows were human reviewed.

## Public contract and retained data

- The Pulse runtime snapshot is `pulse-v2.13-beta`, hash
  `e4b3e0c2b51b99a0e49f31716c90d6fe9cd5df5a6d09d9138b54fe11640ee7b3`.
  It declares stored provider-distinct agreement, queue-only single-engine
  handling, and the legacy quarantine policy.
- API documentation strict-validates all 17 examples. The unanimous Pulse
  changelog example contains three provider-distinct stored classify runs with
  prompt, method, configuration, and panel-size identity.
- Pulse event, country-dimension, and changelog APIs use
  `PULSE_METHODOLOGY_META`; the validator rejects the Index metadata helper on
  those routes.
- After the repair, dimensional recomputation considered the 13 retained
  human-published events, wrote 325 current jurisdiction-dimension rows, and
  retained 975 immutable outputs across three score runs.

## Operational safety

- The explicit repair is idempotent: its second dry run produced zero changes.
- The migration registry, live zero-write plans, research-evidence retention,
  TypeScript, runtime snapshot, API contract, claims, and production build
  gates pass.
- Index/Pulse presentation change control advanced append-only to
  `civica-index-pulse-stored-ensemble-v20`.
