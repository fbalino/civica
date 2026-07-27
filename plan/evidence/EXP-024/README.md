# EXP-024 — Layering-contract evidence

Completed 2026-07-18 in commit `5b470a8a`.

## Contract

`globals.css` now defines one strictly ascending document layer contract:
`--z-base`, `--z-rule`, `--z-sticky`, `--z-popover`, `--z-tooltip`,
`--z-overlay-backdrop`, `--z-overlay`, `--z-modal-backdrop`, `--z-modal`, and
`--z-toast`. The canonical design-system page publishes the purpose and order
of each layer. Its internal sticky bar is offset by `--header-height`, avoiding
an equal-layer collision with the global header.

Document-level navigation, listboxes, tooltips, map/fact panels and backdrops,
mobile rails, lightboxes, map dialogs, and the Outcomes modal now bind to this
scale. The static `stacking-contract.test.ts` fails if a new raw document-level
z-index exceeds the reserved local-artwork range, if token order changes, or if
representative consumers drift from their role bindings.

## Browser verification

`e2e/exp-024-stacking.spec.ts` ran in a detached disposable worktree against a
local server on port 3100:

```sh
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-024-stacking.spec.ts
# 3 passed (12.0s)
```

The suite verifies the rendered design-system layer reference and sticky-header
clearance; desktop Explore and select popovers plus source-dot tooltip level;
the Switzerland map dialog and photo lightbox taking the header hit target; and
the mobile main-menu dialog taking the header hit target and restoring its
launcher on close. The isolated run recorded no console/page/request/HTTP hard
failures. No production mutation, form submission, or external paid-model
request occurred.
