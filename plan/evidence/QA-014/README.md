# QA-014 — Reader performance and payload regression evidence

Completed 2026-07-18.

## Contract

`civica-reader-performance-budget/v1` gives four production-reader fixtures
fixed caps for decoded HTML and RSC bytes, JavaScript, CSS, images, fonts,
request count, server response, LCP, CLS, interaction timing, and long tasks:
home, Atlas, the Switzerland constitution reader, and an engraving-led Record
article. Atlas also has a map-initialization cap. The fixture registry links
the country and constitution views to the pre-existing `civica-query-budget/v1`
profiles, which continue to own query p95 and result-shape validation.

The native browser observers fail closed if LCP or an actual interaction-timing
entry is absent. A pure test rejects an oversized image payload and missing
Atlas initialization. The required CI job starts the built app and runs the
credential-free home/Record subset; Atlas and constitution execute when
`E2E_PERFORMANCE_FIXTURE_DB=1` selects a controlled, read-only fixture database.
They are skipped in the no-database run rather than treating a `500` fallback
as a measured reader route.

These are laboratory regression ceilings, not a public claim of field Core Web
Vitals. The approach was checked on 2026-07-18 against [web.dev’s Core Web
Vitals guidance](https://web.dev/articles/vitals) and [MDN’s
PerformanceObserver reference](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver).

## Isolated production measurements

A detached worktree built the exact application with `npx next build`, served
it on local port 3100, and ran a fresh Chromium context against the configured
development database. The final full-surface result was 4/4 passing:

```sh
E2E_BASE_URL=http://localhost:3100 \
E2E_PERFORMANCE_FIXTURE_DB=1 \
  npm run test:e2e:performance
# 4 passed (17.3s)
```

| Fixture | HTML | JS | CSS | Images | Requests | LCP | INP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 957,430 B | 705,789 B | 403,492 B | 4,030,299 B | 98 | 2,932 ms | 32 ms | 0.0036 |
| Atlas | 1,615,875 B | 739,441 B | 403,492 B | 2,132,602 B | 90 | 7,260 ms | 40 ms | 0 |
| Constitution | 1,405,992 B | 2,518,563 B | 519,941 B | 3,266,763 B | 112 | 1,540 ms | 24 ms | 0.0010 |
| Record article | 801,849 B | 702,129 B | 403,492 B | 2,396,772 B | 91 | 1,340 ms | 24 ms | 0 |

Atlas reached its geometry-ready state in 7,724 ms (cap: 10,000 ms). The only
observed long task was 108 ms on the constitution route (cap: 650 ms); the
other fixtures reported none. Each metric and its declared budget is attached
to the Playwright result as JSON.

The exact credential-free CI mode also passed against the same production
build with no `.env.local`: home and Record passed, while the two database
fixtures were intentionally skipped (2 passed, 2 skipped). It did not write
production data, deploy, submit forms, or call a paid model.

## Static verification

```sh
npx tsc --noEmit
node --import tsx --test \
  src/lib/qa/reader-performance-budget.test.ts \
  src/lib/platform/ci-workflow-contract.test.ts
# 16 passed
npm run validate:ci-workflow
```

The broader `npm run build:ci` remains blocked before `next build` by the
unrelated existing `atl-014-source-native-compare-presentation` Index
change-control documentation drift. The isolated direct production build and
the QA-014 checks above are green; this task does not absorb or waive that
separate release-control finding.

The repository-wide lint gate also reports three existing violations in
`SingleSelectMenu.tsx`, `Tooltip.tsx`, and
`pipeline-observability.test.ts`; their contents are unchanged from the
pre-task `b7f04e41` baseline. They are outside this budget contract and remain
separate owner follow-ups.
