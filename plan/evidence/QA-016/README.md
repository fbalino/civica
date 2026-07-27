# QA-016 — Supported-browser and graceful-degradation evidence

Completed 2026-07-18.

## Support boundary

`civica-reader-browser-support/v1` declares current Playwright-managed desktop
Chromium, Firefox, and WebKit profiles for critical reader journeys. This is
not a claim that all historical browser versions, browser extensions, or the
branded Firefox/Safari applications have been tested. The selection and its
limits were checked on 2026-07-18 against the
[Playwright browser documentation](https://playwright.dev/docs/browsers).

The public [accessibility page](/accessibility) states the same bounded support
and degradation posture. `browser-support-chromium.png` and
`record-no-js-chromium.png` are production-server captures of that reader
surface and the no-JavaScript reading path.

## Production-browser verification

An isolated detached checkout at implementation commit `12606af9` installed
the lockfile, built with `npx next build`, and served the production output on
local port 3101. No production write, deployment, form submission, or paid
model call occurred.

| Environment | Command | Result |
| --- | --- | --- |
| Credential-free | `E2E_BASE_URL=http://localhost:3101 npm run test:e2e:browser-support` | 6 passed: home navigation, accessibility disclosure, Record, and no-JavaScript rendering in Chromium, Firefox, and WebKit; 12 controlled data fixtures correctly skipped. |
| Controlled read-only fixture DB | `E2E_BASE_URL=http://localhost:3101 E2E_PERFORMANCE_FIXTURE_DB=1 npm run test:e2e:browser-support` | 10 passed, 8 skipped: the same six cross-browser checks plus Chromium simulations for external Atlas geometry, country-map initialization, Wikimedia portrait failure, and Ask Civica `503`. |

The Atlas simulation blocks `unpkg.com` and proves the checked local geometry
and table alternative remain. The country-map simulation removes canvas
initialization and proves the map moves from self-hosted source to the
keyless fallback or a visible unavailable status. The portrait test blocks
the Commons FilePath request and proves the monogram replacement appears. The
Ask Civica test intercepts the request before it reaches a provider and
asserts only the generic temporary-unavailability message.

Pulse source-outage semantics are covered in the focused unit fixture:
`src/lib/pulse/v2/observability.test.ts` proves a failed source basket is
`source_outage` and `not_assessable`, never a no-event or country-quality
conclusion.

## Focused static verification

```sh
npx tsc --noEmit
node --import tsx --test \
  src/lib/qa/browser-degradation-contract.test.ts \
  src/lib/pulse/v2/observability.test.ts \
  src/lib/api/contract/source-coverage-contract.test.ts \
  src/lib/platform/ci-workflow-contract.test.ts
npm run validate:ci-workflow
npm run validate:design-tokens
```

All named checks passed. The repository-wide lint gate still reports three
pre-task violations in `SingleSelectMenu.tsx`, `Tooltip.tsx`, and
`pipeline-observability.test.ts`; those files are unchanged from `b7f04e41`.
The broader `npm run build:ci` remains separately blocked before `next build`
by existing ATL-014 Index change-control documentation drift; the isolated
direct production build above passed.
