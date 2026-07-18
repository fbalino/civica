# EXP-022 — Reduced-motion evidence

Completed 2026-07-18 in commit `cc051fe7`.

## Contract

At `prefers-reduced-motion: reduce`, the shared stylesheet removes
nonessential animation and transition effects. Editorial entrance and parallax
components retain their existing static, fully visible branch. The Atlas map
settles a selected-country transform immediately and cancels a previous
request-animation-frame flight before another flight or direct manipulation.

## Browser verification

`e2e/exp-022-reduced-motion.spec.ts` ran in a detached disposable worktree
against a local server on port 3100:

```sh
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-022-reduced-motion.spec.ts
# 3 passed (13.2s)
```

The checks cover:

- home editorial title and parallax remaining static and visible, plus the
  Explore menu opening and returning focus on Escape;
- Atlas native country selection settling without an in-progress flight; and
- the country map dialog opening/closing without transition motion and
  returning focus to its launcher.

The isolated run recorded no console/page/request/HTTP hard failures. No
production mutation, form submission, or external paid model request occurred.
