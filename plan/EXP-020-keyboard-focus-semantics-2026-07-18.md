# EXP-020 — keyboard, focus, and semantic-control completion

## Scope

Close the remaining P0 reader-experience control contract using the existing
QA-012 browser matrix as behavioural evidence. The required classes are
navigation, filters, drawers, lightboxes, maps, charts, tables, search,
segmented controls, accordions, and forms.

## Completion path

1. Keep QA-012's real-browser axe and keyboard matrix as the behavioural
   evidence for every named control class, including focus restoration and
   error-state focus.
2. Replace any remaining pointer-only live reader control with a native
   semantic element or a documented keyboard-equivalent.
3. Add a source-level guard for non-native click handlers, with narrowly
   reviewed exceptions only for passive backdrops or components that provide
   their complete ARIA/keyboard contract locally.
4. Run the focused guard, TypeScript, design-token validation where UI code
   changes, and the full accessibility command in an isolated real browser.
5. Record evidence, update both checklist mirrors and `plan/PROGRESS.md` only
   after every gate passes.

## Boundary

This task does not assert universal screen-reader conformance. The manual
assistive-technology review remains explicitly open in QA-012; EXP-020 is
limited to the master checklist's scripted keyboard/focus and semantic-control
contract.
