# QA-013 / EXP-025 — visual-regression baselines

## Status

In progress. This plan establishes one visual-regression contract for the
quality gate (QA-013) and its canonical-module coverage requirement (EXP-025).
No baseline is considered approved merely because it was generated locally.

## Scope and coverage matrix

Every visual case is rendered in light and dark themes at desktop and
small-mobile viewports. The canonical surface set is:

1. `/design-system`, home, open Explore menu, and branded error/404;
2. country Factbook and Civica Data tabs, Atlas, and Compare;
3. Index, Pulse ledger/data state, methodology, constitution, elections, and
   The Record;
4. API documentation, advisory board, and an embed;
5. a representative unavailable/empty/disputed data state where the fixture
   exposes one.

Routes without a data dependency run in credential-free CI. Fixture-backed
cases run only when `E2E_PERFORMANCE_FIXTURE_DB=1` declares the controlled
read-only test database; the test report must make that boundary visible.

## Determinism contract

- Chromium version is lockfile-pinned by Playwright; screenshot cases wait for
  fonts and stable rendered targets, disable animations/caret, and use fixed
  viewports, themes, locale, timezone, and reduced-motion settings.
- Screenshot inputs use committed local assets plus the declared fixture data;
  live network-only content, clocks, randomized IDs, and volatile telemetry are
  excluded or masked rather than silently accepted.
- Each baseline records its route, viewport, theme, state, fixture requirement,
  browser project, and input-contract hash in a checked manifest.

## Review and update workflow

1. `npm run test:e2e:visual` compares against checked baselines and writes
   Playwright diffs only under ignored `output/playwright/`.
2. A candidate update must be generated explicitly with
   `VISUAL_BASELINE_UPDATE=1`; normal test/CI commands never rewrite expected
   artifacts.
3. The update command requires a reviewer name and reason, writes the pending
   baseline manifest, and reports every changed case. A reviewer then inspects
   the image diff and promotes the manifest/artifacts in the same change.
4. A contract test mutates one declared visual token in an in-memory fixture
   and proves that the baseline comparator rejects the altered result.

## Completion conditions

Check EXP-025 and QA-013 only when every matrix case has an approved,
checked baseline, both the credential-free and controlled-fixture commands
pass, the review/update workflow is documented in evidence, and the seeded
one-token drift test fails as designed.
