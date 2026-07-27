# EXP-014 — Explore navigation concept study

**Completed:** 2026-07-18

Three non-production, design-system-compliant navigation directions are
rendered at `/design-system#explore-concepts`:

1. **The scholarly index** — typography-first two-register reference list.
2. **The civic cabinet** — named destinations with functional line emblems.
3. **The reading room** — two-register editorial panel with existing spot art.

Each uses the one shared eight-destination identity, semantic links, existing
light/dark tokens, and a defined desktop/mobile treatment. The complete
comparison brief (including focus behavior, performance budgets, and asset
plans) is `plan/EXP-014-explore-navigation-concepts-2026-07-18.md`.

## Dated browser mockups

The 12 committed captures follow
`YYYY-MM-DD-<concept-id>-<viewport>-<theme>.png` under `mockups/`: three
concepts × desktop/small-mobile × light/dark. They were captured from the real
design-system route in a disposable detached worktree.

## Verification

```sh
npx tsc --noEmit --pretty false
# exit 0

npm run validate:design-tokens
# pass; 209 pre-existing baseline violations remain

EXP014_CAPTURE_DIR=plan/evidence/EXP-014/mockups \
E2E_BASE_URL=http://localhost:3100 \
npm run test:e2e -- e2e/exp-014-explore-concepts.spec.ts
# 4 passed
```

The browser contract verifies all three directions retain the exact shared
eight destinations, focus a real link, and do not introduce horizontal
overflow in desktop/small-mobile and light/dark scenarios. It allows only the
known pre-existing design-system ramp/tooltip hydration diagnostic and fails
on any other captured error. No production navigation, database, deployment,
or external provider state changed.
