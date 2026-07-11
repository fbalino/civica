# DAT-023 — Immutable frozen vintages

Completed 2026-07-11.

## Outcome

- Migration `0025_immutable_frozen_vintages` is applied to production.
- Frozen Atlas and named Civica Index rows reject every update and deletion at the database layer.
- The Atlas writer compares an existing row and skips an exact match; changed content under the same label fails.
- The Index writer uses a deterministic release seed, hashes every named score row, skips exact matches, and fails on changed content under the same label.
- Corrected releases require a new methodology/version label and an explicit `supersedes_vintage_label` pointing to an existing frozen release.
- The Atlas cut's 17,506 rows were repaired from stored `v0.1-beta` to the `v0.2-beta` version printed in their public label before the immutability trigger was installed.
- All 237 named Index rows now have checked content hashes.

## Objective acceptance

| Requirement | Evidence |
|---|---|
| Different content under an existing label fails | Application conflict checks plus database UPDATE/DELETE rejection triggers; rollback-only live mutation probes passed. |
| Stored version equals published version | Live audit reports 0 Atlas and 0 Index version mismatches. |
| Identical reruns are no-ops verified by hashes | Atlas repeatability fixture writes once across two applications; deterministic hash fixtures and named Index hash validation pass. |
| Corrections require a new superseding version | Shared `assertSupersession`, both writers, and both database insert triggers require an existing supersession target for a second release of a period. |

## Verification

- `npm run validate:frozen-vintages`: pass (17,506 Atlas rows; 237 Index rows; 4/4 triggers).
- Rollback-only mutation probes: Atlas update rejected; named Index update rejected.
- Transactional migration rehearsal: pass; all changes rolled back before the checked application.
- `npm test`: 626/626 pass.
- `npm run build`: pass, including all claims/documentation and data gates.
- `npm run validate:migrations` and `npm run validate:migration-preflight`: pass for all 39 registered artifacts.
- TypeScript: pass.

No reader-facing UI changed, so browser visual review was not applicable.
