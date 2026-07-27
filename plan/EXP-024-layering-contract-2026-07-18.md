# EXP-024 — Layering contract and collision coverage

## Design brief

- **Visual thesis:** reader controls should feel anchored to a calm document
  plane, with one predictable elevation scale rather than competing floating
  surfaces.
- **Content plan:** document the layer order in the canonical design-system
  page, bind overlays and transient controls to those named tokens, then prove
  representative menu, tooltip, map, and dialog interactions respect the
  order.
- **Interaction thesis:** a popover stays below a dialog; a tooltip follows its
  focused control but never leaks above an active overlay; a modal blocks the
  sticky shell and restores its launcher when dismissed.

## Completion path

1. Inventory cross-surface stacking contexts and distinguish local artwork
   ordering from document-level layers.
2. Extend the shared z-layer token scale and migrate document-level controls,
   tooltips, overlays, dialogs, and navigation to it.
3. Publish the order and intended consumers on `/design-system`.
4. Add browser collision coverage at desktop and mobile viewports, including
   navigation, a popover, a tooltip, and the country map dialog/lightbox path.
5. Run type, design-token, browser, and master-plan validation before recording
   completion evidence.

## Implemented contract

- The shared scale now names document, rule, sticky, popover, tooltip,
  overlay-backdrop, overlay, modal-backdrop, modal, and toast layers in strict
  ascending order. Local illustration/chart ordering remains deliberately low
  and cannot compete with document-level surfaces.
- The canonical `/design-system` page renders the documented layer order. Its
  own sticky reference bar clears the global header through
  `--header-height`, rather than sharing its viewport edge.
- All formerly raw high document-level `z-index`/`zIndex` values now use the
  named token appropriate to their role: navigation and listboxes, source/map/
  chart tooltips, fact panels and backdrops, mobile rails, map dialogs,
  lightboxes, and the Outcomes modal.
- A static guard rejects future raw document-level z-index values above local
  artwork range and asserts the ordered token list plus representative role
  bindings.
- The real-browser collision suite covers design-system documentation and
  sticky offset, desktop navigation and select popovers, source tooltips, map
  dialog and photo lightbox covering sticky chrome, and the mobile navigation
  modal covering and restoring its trigger.

## Verification

```sh
npx tsc --noEmit
node --import tsx --test src/lib/design/stacking-contract.test.ts
npm run validate:design-tokens
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-024-stacking.spec.ts
# 3 passed
```

The browser run used an isolated disposable worktree and port 3100. It issued
reader GET requests only; it did not submit forms, write production data, or
deploy.
