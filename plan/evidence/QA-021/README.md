# QA-021 — G4 local gate repair

## Result

The fixed G4 command matrix now passes all six local commands. Its overall
status remains correctly `blocked`: 27 P0 and 58 P0/P1 tasks still require
human decisions, external review, production or staging authority, unavailable
publisher evidence, elapsed observation time, or completion of those
dependencies. No waiver, approval, deployment, production mutation, paid model
call, external review, or elapsed observation was claimed.

## Repairs

- Extended the checked DAT-013 live, zero-write preflight from 63 to all 66
  migration artifacts, adding migrations 0046, 0047, and 0048.
- Removed all 31 ESLint errors while preserving the repository's tolerated
  warning posture.
- Regenerated the Atlas review packet from its tracked inputs.
- Corrected DAT-034's preregistration file hash and semantic wrapper hash
  without changing the frozen 300-row sample, its official checks, or its
  blocked-source-evidence result.
- Added exact-hash compatibility for three type-only Index lint repairs. A
  negative-control test proves any further byte change again triggers normal
  methodology-drift detection.
- Consolidated the admin corrections heading so the landmark ratchet sees one
  page H1.
- Split the Edge-safe Atlas query contract from the Node-only artifact loader,
  allowing constitution search page-data collection to complete.

## Verification

The fixed G4 runner completed on 2026-07-23:

| Command | Result | Duration |
| --- | --- | ---: |
| `node plan/tools/validate-master-plan.mjs` | passed | 32 ms |
| `npm run validate:verification-matrix` | passed | 2,254 ms |
| `npm test` | passed | 19,682 ms |
| `npm run typecheck` | passed | 3,019 ms |
| `npm run lint` | passed | 22,437 ms |
| `npm run build` | passed | 127,680 ms |

Additional focused checks passed:

- `npm run validate:migration-preflight` — 66/66 plans;
- `npm run validate:migrations`;
- `npm run validate:index-change-control`;
- `npm run validate:atlas-value-fidelity`;
- `npm run validate:landmarks`;
- request-contract and frozen Atlas query tests; and
- a direct Next.js production compilation through page-data collection.

The implementation is committed as `e9caeaa8`.
