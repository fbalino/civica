# EXP-020 — keyboard, focus, and semantic-control evidence

Completed 2026-07-18.

## Control coverage

`npm run test:e2e:a11y` runs the shared Playwright harness against the real
application. Its 47 passing Chromium checks include 30 no-suppression WCAG
A/AA axe audits across reader, contact-validation, owner sign-in error, and
independent-coding sign-in error states; 11 shared-control keyboard journeys;
and six contact/sign-in error journeys from EXP-034.

The keyboard coverage reaches or operates all EXP-020 control classes:

- navigation and the mobile navigation drawer: Enter, Escape, focus trap and
  focus restoration;
- filters and select menus: arrow navigation, selection, focus return;
- lightboxes and map dialogs: Enter, focus trap, Escape and restoration;
- maps: synchronized native Atlas selection/compare and semantic organization
  membership-map country links activated with Enter;
- charts: keyboard series toggles;
- tables: keyboard sorting with an announced `aria-sort` result;
- search, segmented controls, citation tabs/accordions, and contact/sign-in
  forms, including invalid-field/error-alert focus.

## Semantic-control guard

`src/lib/qa/clickable-semantics.test.ts` parses every direct intrinsic JSX
element carrying `onClick`. It fails unless the element is native interactive
markup, has a supported role plus key handler, or is one of the narrow,
reviewed passive surfaces documented in the test. Pointer-enhanced Atlas and
strip-plot graphics are permitted only because their components own a labelled
keyboard-equivalent control.

Organization membership-map shapes were converted from click handlers to
native SVG links, with focus styling, and the browser journey verifies Enter
navigates to the linked country.

## Verification

```sh
npm run validate:design-tokens
# PASS — no new design-token drift

npx tsc --noEmit --pretty false
# PASS

node --import tsx --test src/lib/qa/clickable-semantics.test.ts
# 1 passed

E2E_BASE_URL=http://localhost:3100 npm run test:e2e:a11y
# 47 passed (46.6s), exit 0
```

The browser run used an isolated disposable worktree and did not submit forms,
call mutations, or write production data. QA-012 retains the separate
human-assisted screen-reader review item; that external/manual evidence is
not claimed by this scripted-control completion.
