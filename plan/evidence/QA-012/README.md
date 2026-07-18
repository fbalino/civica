# QA-012 — accessibility automation and keyboard journeys

Partial evidence recorded 2026-07-18. QA-012 remains open: its done-when
criterion requires the full canonical control/state matrix, including the
admin and isolated-fixture surfaces owned by QA-011.

## Current implementation

- `npm run test:e2e:a11y` runs `e2e/qa-012-accessibility.spec.ts` and
  `e2e/qa-012-keyboard.spec.ts` through the shared real-browser harness.
- The audit injects the lockfile-pinned `axe-core` runtime and fails on all
  WCAG A/AA violations, including computed contrast. It uses no suppressions.
- The suite records the compact axe result for each case as a Playwright
  attachment. HTML/JSON reports, traces, and failure screenshots remain in the
  gitignored `output/playwright/` directory.
- Keyboard journeys cover desktop Explore disclosure and Escape focus return,
  mobile-menu focus trap and Escape focus return, country search selection,
  and roving focus for shared segmented controls (Arrow, Home, End).

## Isolated browser evidence

An isolated disposable worktree ran the real application on port 3100 against
the configured development environment. The final command and exit status:

```sh
E2E_BASE_URL=http://localhost:3100 npm run test:e2e:a11y
# 26 passed (33.5s), exit 0
```

Coverage: eleven canonical reader routes in light and dark themes (22 audits):
home; country Factbook; country Civica Data; Atlas; selected Compare; rankings;
Conditions; methodology; API documentation; contact; and branded 404. The four
keyboard journeys above make 26 checks total.

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

## Limitations and next evidence

This result does not demonstrate all controls or assistive technologies. It is
Chromium plus automated axe and scripted keyboard coverage, not a claim of
universal WCAG conformance. The remaining reader controls and the admin/reviewer
states must be added after QA-011's isolated fixture environment exists. A
documented manual assistive-technology review is still required before checking
QA-012 in the master checklist.
