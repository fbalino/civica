# CLM-002 evidence — Canonical public claim tiers

**Task:** Adopt one canonical evidence-tier vocabulary and prove that every
registered claim maps to exactly one tier.

**Commit:** `feat(claims): establish public claim registry and tier policy (CLM-001, CLM-002)`

## Outcome

- `plan/decisions/claim-tier-v1.md` defines allowed language, required
  disclosure, and prohibited language for source-reported facts, reconciled
  facts, derived descriptive metrics, research-beta estimates, experimental
  heuristics, and retired/deprecated outputs.
- A seventh `institutional-posture` tier covers the product-status, policy,
  rights, advisory, and academic-standing claims that CLM-001 explicitly
  requires but that are not empirical measurements.
- `src/lib/claims/claim-tiers.ts` is the typed, machine-readable contract. Each
  tier has a stable ID, definition, allowed language, required disclosure, and
  prohibited language.
- `src/lib/claims/public-claims.test.ts` proves each registry entry has one
  scalar canonical tier and includes seeded negative fixtures.

## Verification

| Command | Result |
|---|---|
| `npm run validate:public-claims` | Exit 0 — 7 canonical tier IDs, 7 complete definitions, and every one of 24 claims classified once. |
| `npm test` | Exit 0 — full suite passed; tier mapping and negative fixtures passed. |
| `npx eslint src/lib/claims/claim-tiers.ts src/lib/claims/public-claims.ts src/lib/claims/registry-validation.ts src/lib/claims/public-claims.test.ts scripts/validate-public-claims.ts` | Exit 0. |
| `npm run build` | Final run passed compilation, TypeScript, and static generation with only the known broad-trace warning. |
| `node plan/tools/validate-master-plan.mjs` | Exit 0 after checklist update — master and area copies agree. |

## Fixtures and artifacts

- The multi-tier fixture assigns an array of tiers to a claim and must fail.
- The missing-surface fixture removes embed claims and must fail.
- Primary artifacts: `plan/decisions/claim-tier-v1.md`,
  `src/lib/claims/claim-tiers.ts`, and
  `src/lib/claims/public-claims.test.ts`.

## Limitations and manual checks

- Tier assignment controls disclosure; it does not graduate an estimate or
  replace G3 statistical validation or G5 independent human review.
- No browser or external/manual check is required for this policy-and-test task.
