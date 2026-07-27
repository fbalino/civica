# EXP-021 — Contrast and non-color evidence

Completed 2026-07-18 in commit `06eb4699`.

## Contract

The shared button, design-system state-chip, government-type example, and
directive-link treatments meet the adopted WCAG A/AA contrast target in both
themes. Their semantic status remains available through text, visible borders,
weight, underline, disabled semantics, or source-state labels rather than colour
alone. Indicator-ramp swatches carry accessible names.

The canonical tooltip is structurally stable across server rendering and initial
client hydration. After hydration it resolves the DOM focus target, keeping a
native child interactive or making a bare trigger keyboard reachable. The open
tooltip describes that actual focus target.

## Browser verification

`e2e/exp-021-contrast.spec.ts` ran in a detached disposable worktree against a
local server on port 3100:

```sh
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-021-contrast.spec.ts
# 8 passed (9.0s)
```

The suite runs WCAG 2.0/2.1/2.2 A/AA Axe audits for the design-system state
reference, Atlas map, and country indicator chart in light and dark themes. It
also asserts readable source-state provenance, a visible keyboard focus ring,
disabled/experimental semantic text, and that a deliberately broken
`--color-text-primary` token produces a `color-contrast` failure.

The isolated run recorded no console/page/request/HTTP hard failures. No
production mutation, form submission, or external paid-model request occurred.
