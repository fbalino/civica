# EXP-033 — Atlas selection and comparison accessibility

## Objective

Make `/atlas` truthful and operable without a pointer. The map remains a visual
overview; the native country control is the canonical accessible route to the
same selection, profile, and two-country comparison state.

## Acceptance mapping

| Checklist requirement | Implementation / evidence target |
| --- | --- |
| Page H1 | Visible `World Atlas` H1 in the Atlas control header. |
| Keyboard-accessible country selection | Native labelled country selector with profile and comparison actions. |
| Map/list synchronization | One `selectedCountryId` drives the selector, map highlight, map fly-to, and live status. |
| Keyboard activation | Selector, canonical buttons, and the existing data-layer segmented control are covered in QA-012. |
| Truthful touch comparison | A map tap selects only; the visible Country controls explain the explicit two-country add flow. |
| Pointer parity | A map-path selection writes back to the native selector and status. |

## Required verification before completion

1. Run the focused real-browser QA-012 Atlas journey against the current
   worktree, including keyboard select, pointer-to-list synchronization,
   two-country comparison enablement, desktop/mobile, and both themes.
2. Run the full `npm run test:e2e:a11y` matrix with no axe violations.
3. Inspect `/atlas` in a real browser at the supported responsive matrix.
4. Store stable evidence under `plan/evidence/EXP-033/`, add the matching
   `plan/PROGRESS.md` line, then—and only then—check EXP-033 in both checklist
   mirrors.

## Completion

Completed 2026-07-18. The focused Chromium contract passed at desktop and
small-mobile widths in both themes, and the expanded accessibility suite passed
51 checks. The durable evidence is `plan/evidence/EXP-033/README.md`.
