# QA-012 — accessibility automation and keyboard journeys

Automated evidence updated 2026-07-18. QA-012 remains open only for a
documented human-assisted screen-reader review; its canonical control/state
matrix is now covered by the command below, including public admin error
states and the isolated form journeys owned by EXP-034/QA-011.

## Current implementation

- `npm run test:e2e:a11y` runs `e2e/qa-012-accessibility.spec.ts` and
  `e2e/qa-012-keyboard.spec.ts` through the shared real-browser harness.
- The audit injects the lockfile-pinned `axe-core` runtime and fails on all
  WCAG A/AA violations, including computed contrast. It uses no suppressions.
- The suite records the compact axe result for each case as a Playwright
  attachment. HTML/JSON reports, traces, and failure screenshots remain in the
  gitignored `output/playwright/` directory.
- Keyboard journeys cover desktop Explore disclosure and Escape focus return;
  mobile navigation drawer focus trap and Escape focus return; country search;
  filters; shared select menus; sortable tables; indicator-chart series
  toggles; segmented controls; map/lightbox dialogs; citation tabs; and Atlas
  selection/comparison. The integrated EXP-034 journeys cover contact
  reachability and validation focus plus both sign-in error alerts.

## Isolated browser evidence

An isolated disposable worktree ran the real application on port 3100 against
the configured development environment. The final command and exit status:

```sh
E2E_BASE_URL=http://localhost:3100 npm run test:e2e:a11y
# 47 passed (46.6s), exit 0
```

Coverage: fourteen canonical reader/admin routes in light and dark themes
(28 audits): home; country Factbook; country Civica Data; country longitudinal
chart; Atlas; selected Compare; rankings; Conditions; methodology; API
documentation; contact; owner sign-in error; coding sign-in error; and branded
404. Contact validation is also audited in both themes, for 30 axe audits.
Eleven shared-control keyboard journeys plus six contact/sign-in form journeys
make 47 checks total.

The dark API-documentation audit was additionally repeated three times after
the shared-token repair: 3/3 passed. The mobile-menu keyboard journey was
repeated three times after the test waited for client hydration: 3/3 passed.

## Findings repaired before the passing run

- Shared tonal chips, reader links, home feature text, 404 text, API method
  badges, reader navigation, and dark-theme semantic tokens now meet the
  audited contrast requirements.
- Methodology hub Beta labels now use the canonical `BetaChip`, not a local
  hand-rolled pill.
- Informative controls gained names/roles where missing; segmented controls
  now provide the keyboard behavior their tab semantics promise.
- Decorative Atlas map layers no longer intercept country pointer selection;
  the accessible native selector and map remain synchronized.
- Organization membership-map country shapes are semantic links, so the
  complete roster remains keyboard-operable on both its visual and list views.
- The country-search shortcut, Conditions footer links, and coding sign-in
  owner link now meet the audited contrast and link-discernibility rules.

## Limitations and next evidence

This result does not demonstrate every assistive technology. It is Chromium
plus automated axe and scripted keyboard coverage, not a claim of universal
WCAG conformance. Before checking QA-012 in the master checklist, add a
non-mutating manual screen-reader review of the reader country route, contact
validation, and both sign-in error pages. Record the browser, assistive
technology/version, navigation keys, observed labels/announcements, and any
findings here. An attempted local assistive-technology bridge could not attach
within its bounded run, so no manual result is claimed or inferred.
