# CLM-001 evidence — Public claims registry

**Task:** Create a machine-readable registry for headline empirical and
institutional claims across every required public surface.

**Commit:** `feat(claims): establish public claim registry and tier policy (CLM-001, CLM-002)`

## Outcome

- `src/lib/claims/public-claims.ts` registers 24 claims across all 14 required
  surfaces: home, country, Index, Pulse, methodology, about, licensing,
  advisory board, API docs, README, `CITATION.cff`, metadata, exports, and
  embeds.
- Every row records a stable ID, route/artifact, exact sentence or dynamic
  template, one claim tier, evidence sources, implementation owner,
  methodology version, gate, source file, and exact source fragment.
- Non-rendering `PUBLIC_CLAIM: <id>` markers connect registry rows to the live
  copy. README markers exist in both the template and generated artifact.
- `scripts/validate-public-claims.ts` checks required-surface coverage,
  required fields, unique IDs, tier validity, source/evidence paths, exact-copy
  drift, generated mirrors, orphaned markers, and unregistered marked claims.

## Verification

| Command | Result |
|---|---|
| `npm run validate:public-claims` | Exit 0 — 24 claims, 14/14 surfaces, 29 source/mirror markers, 0 unregistered headline claims. |
| `npm test` | Exit 0 — full repository suite passed, including four new registry fixtures. |
| `npm run validate:content-templates` | Exit 0 — 7 migrated content files clean, 0 unresolved paths/fallbacks. |
| `npm run regenerate:readme` | Exit 0 — generated README matches its template; live stats resolved with no fallback. |
| `npx eslint src/lib/claims/claim-tiers.ts src/lib/claims/public-claims.ts src/lib/claims/registry-validation.ts src/lib/claims/public-claims.test.ts scripts/validate-public-claims.ts` | Exit 0. |
| `npm run build` | Final run passed compilation, TypeScript, and static generation. The existing Turbopack broad-trace warning remains; the first run exposed an optional-field narrowing error in this validator, which was corrected before the passing run. |
| `node plan/tools/validate-master-plan.mjs` | Exit 0 after checklist update — 288 mirrored tasks, 2 complete. |

## Fixtures and artifacts

- Pure fixtures prove that an unclassified/multi-tier claim and a missing
  required surface fail structural validation.
- No production data was changed. The README generator read current site state
  and live statistics without writing to the database.
- Primary artifacts: `src/lib/claims/public-claims.ts`,
  `scripts/validate-public-claims.ts`, and
  `src/lib/claims/public-claims.test.ts`.

## Limitations and manual checks

- The marker inventory keeps known headline claims synchronized; it does not
  prove that any claim is academically valid. Later CLM tasks qualify/remove
  registered overclaims, and CLM-017 adds broader numeric and prohibited-copy
  discovery in CI.
- No browser check was required because this slice changes only source comments,
  registry code, tests, and planning documents; rendered copy and layout are
  unchanged.
- No manual or external check is queued for this task.
