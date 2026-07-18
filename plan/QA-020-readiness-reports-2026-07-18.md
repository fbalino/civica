# QA-020 — machine-readable gate-readiness reports

## Objective

Create one deterministic reporting contract for G2, G4, G5, and G6. The
reporter must read the canonical checklist, evidence folders, completion log,
manual-check queue, and a closed gate-command registry. It must distinguish
an informative blocked report from a passing gate.

## Design

1. Parse checklist tasks from the numbered area files and verify the master
   mirror through the existing plan validator.
2. Generate one JSON report per requested gate with counts by area/priority,
   every open P0/P1 task, evidence/progress links, manual-check references,
   and an explicit empty waiver list unless a checked waiver record exists.
3. Define fixed gate-command lists. Execution is opt-in; commands are never
   copied from report data or shell-evaluated.
4. A gate can be `pass` only when its task policy, evidence/progress policy,
   and every required command have passed. Open P0/P1 tasks force G4 to
   `blocked`, even if commands happen to pass.
5. Add deterministic fixtures that prove missing evidence/progress, a failed
   command, and an open P0/P1 task all fail closed.

## Acceptance checks

- `npm run generate:readiness-reports`
- `npm run validate:readiness-reports`
- focused node tests for the report contract
- `node plan/tools/validate-master-plan.mjs`
- `npm run typecheck`

## Boundaries

The report does not claim that external review, legal advice, a DOI, or a
deployment occurred. It records those as blockers linked to
`plan/MANUAL-CHECKS.md` until evidence exists.
