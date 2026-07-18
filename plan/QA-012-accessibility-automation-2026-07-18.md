# QA-012 — Automated accessibility and keyboard journeys

## Status

The automated reader, form, and public-admin error-state matrix is complete.
QA-012 remains open only for its documented human-assisted screen-reader
review. The Playwright harness has a dedicated accessibility command:

```sh
npm run test:e2e:a11y
```

It injects the lockfile-pinned `axe-core` browser runtime (verified against
Deque's official Playwright package documentation on 2026-07-18) to audit
representative canonical reader routes and selected states in both themes. Each
audit attaches its compact result JSON to the retained Playwright output; WCAG
A/AA violations, including browser-evaluated contrast failures, fail the test
with affected selectors. This preserves the hash of the already frozen review
packet, which includes `package-lock.json` as an immutable input.

The complementary keyboard suite exercises the desktop Explore disclosure,
mobile navigation drawer focus trap/Escape restoration, country search,
shared select menus, sortable tables, indicator-chart series toggles,
segmented controls, map/lightbox dialogs, citation tabs, Atlas selection and
comparison, and the error paths in the contact and both sign-in forms. The
generic `SegmentedControl` implements arrow, Home, and End movement for every
consumer instead of advertising `tablist` semantics with click-only behavior.

The isolated real-browser run on 2026-07-18 passed all 51 checks with no axe
suppressions: 30 WCAG A/AA route-and-theme/state audits, 11 shared-control
keyboard journeys, four Atlas selection/compare journeys, and six
contact/sign-in form error journeys. Its command, covered states, repaired
findings, and retained output location are recorded in
`plan/evidence/QA-012/README.md`.

## Remaining evidence before completion

1. Conduct and archive a non-mutating manual screen-reader review on the
   current production-candidate browser/build. Cover the reader country route,
   contact validation, and both sign-in error states; record browser,
   assistive technology, navigation keys, observed labels/announcements, and
   any findings in `plan/evidence/QA-012/`.
2. Update the master checklist only if that human-assisted review confirms the
   labels, focus order, and error announcements represented by the automated
   suite. The automated command does not by itself claim universal WCAG
   conformance.
