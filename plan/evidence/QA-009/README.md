# QA-009 — canonical Playwright/browser test harness

Completed 2026-07-12. One command (`npm run test:e2e`) drives the real app
through Playwright with error capture, theme/viewport/auth fixtures, evidence
capture, and a proven seeded-failure gate.

## What shipped
- `playwright.config.ts` — chromium project, reuses a running dev server at
  `E2E_BASE_URL` (default `http://localhost:3000`). **Never auto-spawns
  `next dev`** (a second dev server sharing `.next/dev/cache/turbopack`
  corrupts the running one); CI/explicit runs set `E2E_WEBSERVER_CMD` (e.g.
  `next start` after a production build) to have Playwright own the server.
  Trace on failure, screenshot on failure, HTML + JSON reports under the
  gitignored `output/playwright/`.
- `e2e/harness/fixtures.ts` — the `errors` fixture captures console errors,
  uncaught page errors, failed requests, and >=400 responses (with benign
  dev/telemetry URLs filtered); `hardFailures()` is the fail signal. Helpers:
  `setTheme` (emulates prefers-color-scheme AND stamps `data-theme`),
  `VIEWPORTS`/`THEMES` (the declared matrix), `measureHorizontalOverflow`,
  and `loginAsAdmin` (form login via `E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD`;
  returns false so auth tests skip when no test password is supplied — the
  harness never commits a secret).
- `e2e/harness/routes.ts` — the canonical route ledger (one per DESIGN.md
  layout row + primary reader routes), shared by EXP-019 and QA-010.
- `e2e/harness.selftest.spec.ts` — the acceptance proof.
- `package.json` — `test:e2e` and `test:e2e:report` scripts; `@playwright/test`
  dev dependency.

## Done-when → evidence (all six selftests pass)
- **one command starts/uses the real app predictably** — `test:e2e` reuses the
  running server; the selftest loads the real home page (footer brand present).
- **captures console/network failures** — seeded console error, seeded uncaught
  page error, and a seeded asset 404 are each captured by the fixture.
- **theme/viewport/auth fixtures** — the fixtures test sweeps all six viewports
  × both themes and asserts the applied theme; `loginAsAdmin` helper exists.
- **cleans tabs/processes** — Playwright owns browser lifecycle; no dev server
  is spawned, so nothing to leak.
- **saves evidence** — traces/screenshots on failure + HTML/JSON reports to
  `output/playwright/` (gitignored).
- **fails on a seeded route or asset error** — the seeded 404 route and 404
  asset both populate `badResponses`/`hardFailures()`, proving a normal route
  spec asserting them empty would fail.

## Run
`npm run test:e2e -- e2e/harness.selftest.spec.ts` → `6 passed`.

## Note
Chromium (headless shell) is installed under the ms-playwright cache
(gitignored). A dev server must be running locally (`npm run dev`) or a server
command supplied via `E2E_WEBSERVER_CMD`. QA-010/011/012/013/016 build on this
harness.
