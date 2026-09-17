# EXP-038 correction-routing browser check — 2026-09-17

Command:

```sh
E2E_BASE_URL=http://localhost:3317 npx playwright test \
  e2e/exp-038-copy-and-disclosure.spec.ts \
  --config=.tmp-playwright-system-chrome.config.ts \
  --project=system-chrome --workers=1 \
  --grep "correction routes use"
```

Result: `1 passed (5.5s)` against `next start` on port 3317 using the installed
system Chrome through a temporary local Playwright launch configuration. The
production bundle was built first with `npm run build:ci` under Next 16.3.5;
the temporary browser configuration is not part of the change.

The focused test opens the About disclosure and verifies its current v2
machine-readable artifact plus `/report-data-issue` correction link. It then
opens `/report-data-issue` read-only and confirms the production-rendered
`Report a data issue` page and `Point to the exact record` section. Finally, it
checks the ordinary Contact form, the unchanged GitHub ticket link, and the
Contact success panel's dedicated report-form link. The Contact POST is
fulfilled inside the browser test, so the success state is exercised without a
database write or a live correction submission.

The earlier six-test route matrix remains the evidence recorded in
`browser-check-2026-07-26.md`; this focused run does not restate it as a new
2026-09-17 result. This is local production-render evidence, not evidence of a
deployment or external acceptance.
