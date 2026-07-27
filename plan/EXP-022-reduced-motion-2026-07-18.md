# EXP-022 — Reduced motion and interruptible map travel

## Objective

Respect a reader's `prefers-reduced-motion` setting without hiding content or
making navigation, maps, or dialogs harder to operate.

## Implemented contract

- The shared reduced-motion media query now disables nonessential CSS animation
  and transitions rather than shortening them to a near-zero duration. Native
  controls, focus, and state changes remain immediate.
- `Reveal`, `HeroReveal`, and `ParallaxImage` already render visible static
  content when reduced motion is requested; the browser contract now proves
  that behavior on the home page.
- Atlas map travel now applies its final transform immediately under the
  preference. An animation frame handle also cancels an earlier map flight
  before a new flight, wheel zoom, or pointer drag can compete with it.
- The real-browser test covers the representative editorial, menu, map, and
  overlay paths. It checks that controls remain usable and focus returns after
  closing the dialog.

## Verification

```sh
npx tsc --noEmit
npm run validate:design-tokens
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-022-reduced-motion.spec.ts
# 3 passed
```

The browser run used an isolated disposable worktree and port 3100. It issued
reader GET requests only; it did not submit forms, write production data, or
deploy.
