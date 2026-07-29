# PUL-043 production closure — 2026-07-29

## Result

PUL-043 is complete. The private coding workspace now has append-only
successors for both isolated setup studies whose retained packet hashes differ
from the immutable checked release. Both legacy studies remain intact.

The repair ran on the Neon `main` branch through the guarded production
application role `civica_app_20260727`. The authoritative migration head
remained `0051_eminent_jocasta` before, during, and after the repair. Vercel
Cron stayed disabled, so scheduled writers remained quiescent.

## Preserved state

- The legacy batch-A and batch-B study identities, immutable fingerprints,
  packet snapshots, evidence, and audit history did not change.
- No study, packet, participant, assignment, label, or evidence row was
  updated or deleted.
- No participant, assignment, or label row was inserted.
- The legacy studies remain disabled and preserved beside their isolated
  successors.

## Append-only repair

The batch-A successor prepared by the original reconciliation packet was
already present and valid. The live validator then exposed a separate
batch-B packet-set mismatch. The checked reconciliation contract added the
batch-B successor:

- successor study ID:
  `f4e23e4c-da2b-4d74-9919-d98b8984635e`
- supersession reason: `frozen_packet_hash_mismatch`
- inserted rows: 1 study, 536 packets, and 537 audit rows
- inserted participants, assignments, and labels: zero
- updates and deletes: zero

The guarded replay was idempotent and produced zero further writes.

## Validation

The live packet validator passed against 920 rights-safe retained packets and
two reconciled isolated setup studies. It also confirmed that both legacy
studies remain preserved.

This record does not claim owner sign-off, external review, a prospective
observation start, or any human-label outcome.
