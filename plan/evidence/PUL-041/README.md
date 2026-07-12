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

- `npm run validate:pulse-evaluation-packets`
- `npm run seed:pulse-evaluation-coding-studies` (zero-write dry run)
- `npm run seed:pulse-evaluation-coding-studies -- --apply` (idempotent private import)
- `npm run validate:pulse-evaluation-packets:live`
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
