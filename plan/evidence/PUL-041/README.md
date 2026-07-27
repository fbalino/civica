# PUL-041 — Coder-ready event and system-negative packet releases

Completed 2026-07-11.

## Outcome

`pulse-evaluation-packet-manifest/v1` freezes 920 unlabeled packets linked to `pulse-evaluation-sampling-frame/v1`: the complete 384-item retained event-candidate census and a deterministic 536-item draw from the 978-item system-negative population. The negative draw contains 482 analysis candidates and 54 reserves. Census inclusion probability is one; the negative frame records its primary-stratum draw fraction and base weight.

The checked manifest contains evidence identity/content hashes and safe source/date/language metadata, not publisher title/body/raw payloads. It pins the independent-coding codebook and event ontology by version and semantic hash, carries the three required audit-search families, and rejects production, model, review, owner, or answer fields. Semantic hash: `92553399b323c4bb3122ecfad4acb59fdbe2dec8c40842bd44e58cd90a5799cb`.

Private evidence was rehydrated from the immutable `raw_events` identities into two neutral, disabled workspace studies:

- `pulse-evaluation-batch-a-v1`: 384 packets;
- `pulse-evaluation-batch-b-v1`: 536 packets.

Both studies remain in `setup`. The live validator proves zero participants, credentials, and assignments. Packet jurisdiction is masked as “Independent attribution required”; the checked manifest is an internal crosswalk and is not served through a reader route.

## Verification

- `npm run validate:pulse-evaluation-packets` verifies the checked manifest,
  its semantic hash and rights boundary, and its binding to the checked frozen
  population artifact without consulting mutable current database projections.
- `npm run seed:pulse-evaluation-coding-studies` (zero-write dry run)
- `npm run seed:pulse-evaluation-coding-studies -- --apply` (idempotent private import)
- `npm run validate:pulse-evaluation-packets:live` verifies the two isolated
  setup studies against the checked frozen packet manifest.
- `npm run diagnose:pulse-evaluation-packets:current-database` is an explicit
  diagnostic only. It compares the frozen packet to a reconstruction from
  current mutable projections and must never be used to rewrite the frozen
  artifact when later classifications change those projections.
- `npm run build`

The import was applied twice. The second run detected both studies and converged without duplicate packets or access records.

## Files

- `data/research/pulse-evaluation-packet-manifest-v1.json`
- `src/lib/pulse/v2/evaluation-packets.ts`
- `src/lib/pulse/v2/evaluation-packets.test.ts`
- `scripts/generate-pulse-evaluation-packets.ts`
- `scripts/seed-pulse-evaluation-coding-studies.ts`
- `scripts/validate-pulse-evaluation-packets.ts`

No reviewer or coder was contacted, no credential was issued, and no spending was authorized.

## Validation correction — 2026-07-26

The ordinary build gate previously reconstructed this frozen packet from
current `raw_events.classification_disposition` values. Those values are a
mutable projection: classifications recorded after the population cutoff
legitimately changed the probability-frame strata while leaving the frozen
identity population unchanged. The reconstruction therefore ceased to be a
valid as-of proof and began failing unrelated releases.

The frozen manifest and population artifact remain unchanged. Ordinary builds
now validate their complete checked contents and mutual hash binding. Present
database reconstruction remains available as a deliberately named diagnostic;
a true as-of reconstruction would require an immutable snapshot of every
sampling input, including historical strata and source links.

The corrected ordinary validator passes. The two read-only live diagnostics
remain intentionally outside the production build and currently report
pre-existing operational drift: the mutable classification projection no
longer reproduces the July sampling strata, and the disabled setup studies
retain an earlier packet-set hash. Both studies still have zero participants
and zero assignments and remain in `setup`. They must be reconciled through a
new versioned study import, never by rewriting either frozen packet evidence or
the existing study rows.
