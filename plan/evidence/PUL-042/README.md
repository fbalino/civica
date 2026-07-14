# PUL-042 — Frozen evaluation-packet validation

**Status:** Complete
**Implemented:** 2026-07-13

## Outcome

The normal evaluation-packet build gate no longer reconstructs a historical
release from mutable production tables. It reads three checked artifacts:

- `data/research/pulse-evaluation-frame-population-v1.json`;
- `data/research/pulse-evaluation-packet-frozen-inputs-v1.json`;
- `data/research/pulse-evaluation-packet-manifest-v1.json`.

The new frozen-input artifact retains the complete rights-safe inputs for 384
event candidates and all 978 system-negative population rows. It contains
evidence identity/content hashes plus safe source-family, source-type,
language, reported-date, and retrieval-time context. It contains no publisher
title, body, raw payload, production output, model answer, owner answer,
review answer, or gold label.

The capture path searched the append-only `research_evidence_history` states
and accepted only the unique state that reproduced the already checked packet
manifest byte-for-byte. That state ends at
`2026-07-12T08:53:48.502Z`. The normal validator does not repeat that recovery
and does not require Neon. `--write` now verifies the existing immutable
manifest and refuses to replace it with current production state.

## Frozen identities

- Frozen-input semantic SHA-256:
  `4f21465e3586a46fedc64fc89eee5771eff37561b6e89996d12113ab5de1896d`
- Frozen-input file SHA-256:
  `4852b88fdb2709fd758ea44c6643a89d8306d5917bf9a27e17bc1fee07f18f11`
- Checked packet-manifest semantic SHA-256:
  `b683175e07caca1572d86f26b69cdcb17b72023f27b3bee578a960fa46c109bf`
- Checked packet-manifest file SHA-256, unchanged by PUL-042:
  `862aba90af15504fd45fa34f6a5af671b51ba0e5192f51ad277e82fcbeec20ec`
- Frozen events: 384 — April 87, May 84, June 98, July 115.
- Frozen system-negative population: 978 — 97 `non_governance` and 881
  `pending`.
- Released packets: 920 — 384 event census packets and a 536-item negative
  draw, containing 482 analysis candidates and 54 reserves.

## Read-only live audit

`npx tsx scripts/audit-pulse-evaluation-packets-live.ts` is a separate,
read-only comparison. It never rewrites the frozen inputs or checked manifest
and does not fail merely because production has legitimately advanced.

At `2026-07-14T03:36:43.859Z` it reported:

- the same 384 event identities and input contexts;
- the same 978 system-negative identities, with zero additions or removals;
- 43 classification-state changes from `pending` to `non_governance`;
- live negative strata of 140 `non_governance` and 838 `pending`, compared
  with the frozen 97 and 881;
- live reconstruction SHA-256
  `b68fba20f7f0152bfa4dfe7202f1b1417d54d45d1f4ab9e780ae19d6fafebcad`,
  correctly reported as different from the checked release.

The compact machine-readable result is in `live-audit-summary.json`; the live
command prints the exact changed unit references when a row-level audit is
needed.

## Adversarial verification

The focused test suite proves that:

- a seeded post-freeze live event and a later classification change appear in
  the audit but cannot alter the DB-free release validator;
- a changed frozen population unit breaks both its identity and semantic
  hashes;
- a changed checked packet breaks its material and manifest hashes;
- a publisher-payload field added to frozen inputs fails closed;
- recapturing the retained input artifact is idempotent and cannot overwrite a
  different checked artifact.

Commands run:

```text
node --import tsx --test src/lib/pulse/v2/evaluation-packets.test.ts
npm run validate:pulse-evaluation-packets
npx tsx scripts/generate-pulse-evaluation-packets.ts --capture-frozen-inputs
npx tsx scripts/generate-pulse-evaluation-packets.ts --write
npx tsx scripts/audit-pulse-evaluation-packets-live.ts
npx tsc --noEmit --pretty false
```

All passed. The focused suite contains four passing tests.

## Boundary

This task preserves the checked packet manifest exactly; it does not select a
new sample or reinterpret the preregistered release. The checked manifest had
already advanced from the semantic hash cited in the earlier PUL-041 evidence
before PUL-042 began. PUL-042 records the actual checked release it was asked
to preserve rather than silently rewriting that historical evidence.

Publisher payload remains private and is rehydrated only for the disabled
coding workspace. The live audit compares the currently reconstructable
historical-scope rows; the checked frozen inputs, not that mutable comparison,
are the release authority.

The separate pre-existing private-workspace integrity command,
`npm run validate:pulse-evaluation-packets:live`, remains red without any
write: disabled study `pulse-evaluation-batch-a-v1` stores packet-set hash
`0e1089d2de4032f442256cd57f842d54c6f92361e30a4d13ec902f5e38e57e36`,
while rehydrating its current private evidence produces
`100c44c3397474c3c0ef8a96879b2099aa5823e286f65806c9605e6a97285b46`.
PUL-042 does not reseed that study or weaken its validator; resolving private
workspace drift requires a separately authorized database action tracked as
PUL-043.
