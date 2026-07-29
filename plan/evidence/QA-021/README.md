# QA-021 — G4 local gate repair

## Current result — 2026-07-29

The fixed G4 command matrix passes all six local commands at source commit
`b8351519`. Its overall status remains correctly `blocked`: 256/310 tasks are
complete, 54 remain, and 23 P0 plus 50 P0/P1 tasks still require human
decisions, external review, production or staging authority, unavailable
publisher evidence, elapsed observation time, or completion of those
dependencies. It reports zero evidence gaps, zero master-mirror errors, and
zero waivers.

The run used the dedicated release worktree with no `.env.local` and no
`DATABASE_URL`. It reused the repository's existing dependency tree rather
than performing a network install; QA-017 remains the clean-install proof. The
G4 production command is the canonical credential-free `npm run build:ci`, so
no Neon, Vercel, provider credential, migration, deployment, production
mutation, paid model call, external review, or elapsed observation was used or
claimed. The machine-readable runtime record is
`plan/evidence/QA-021/g4-runtime-2026-07-29.v1.json`.

| Command | Result | Duration |
| --- | --- | ---: |
| `node plan/tools/validate-master-plan.mjs` | passed | 39 ms |
| `npm run validate:verification-matrix` | passed | 2,999 ms |
| `npm test` | passed | 43,110 ms |
| `npm run typecheck` | passed | 3,688 ms |
| `npm run lint` | passed | 28,584 ms |
| `npm run build:ci` | passed | 156,524 ms |

## Additional repairs found by the fresh run

- Bound the unified Conditions production orchestrator to the shared
  observability registry and its repeatability contract.
- Added the required append-only Index change-control record for that shared
  non-method input-file edit; Index sources, calculations, scores, ranks,
  release selection, publication, and methodology remain unchanged.
- Regenerated the verification matrix so the Conditions pipeline points to the
  unified orchestrator rather than three retired single-dimension scripts.
- Replaced G4's strict environment-bound build command with Civica's existing
  credential-free CI build. A focused test prevents a future return to a live
  or database-dependent G4 command.

## Original repair scope — 2026-07-23

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

## Historical verification

The original fixed G4 runner completed on 2026-07-23:

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
