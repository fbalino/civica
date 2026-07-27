# EXP-021 — Contrast and non-color communication

## Objective

Prove the canonical reader surfaces meet the adopted WCAG A/AA contrast target
in light and dark themes, and make key state and status signals understandable
without colour alone.

## Implemented contract

- The shared primary-button loading state remains visually actionable at normal
  contrast; only genuinely disabled controls receive reduced opacity.
- The design-system state chips retain a tinted selected background, border,
  and stronger text weight without relying on low-contrast inverse text.
- Government-type examples preserve their coloured border and fill while using
  the readable primary-text token. Directive links now have an underline in
  addition to their colour cue.
- Indicator-ramp swatches have an explicit accessible name. The shared tooltip
  primitive now keeps the server and first client render structurally identical,
  then discovers the DOM focus target after hydration. It preserves keyboard
  access for non-native triggers and describes the element that actually takes
  focus without RSC-child hydration drift.
- `e2e/exp-021-contrast.spec.ts` audits the design-system state reference,
  Atlas map, and country indicator chart in both themes. It additionally checks
  source-state text/provenance, visible focus treatment, disabled and
  experimental states, and proves a deliberately low-contrast semantic token
  is detected by the browser audit.

## Verification

```sh
npx tsc --noEmit
npm run validate:design-tokens
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-021-contrast.spec.ts
# 8 passed
```

The browser run used an isolated disposable worktree and port 3100. It issued
reader GET requests only; it did not submit forms, write production data, or
deploy.
