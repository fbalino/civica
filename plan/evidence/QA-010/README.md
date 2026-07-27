# QA-010 — Critical reader journeys end to end

Evidence for `plan/09-testing-qa-and-release.md` QA-010. Builds on the QA-009
harness (`e2e/harness/fixtures.ts`, `e2e/harness/routes.ts`) — real user
flows (navigate + interact + assert meaningful content), not bare 200 checks.

## Suite

Three spec files, all matched by the substring `qa-010-reader-journeys`:

- `e2e/qa-010-reader-journeys.spec.ts` — home→search→country tabs,
  source/provenance, atlas, compare, indicator history, constitution/search.
- `e2e/qa-010-reader-journeys-content.spec.ts` — elections, organizations,
  the Record (blog), methodology/citation, API docs.
- `e2e/qa-010-reader-journeys-access.spec.ts` — download/export,
  licensing/contact/advisory, 404/error, embed.

## Run command + result

```
npm run test:e2e -- qa-010-reader-journeys
```

```
Running 23 tests using 6 workers
...
23 passed (43.0s)
```

Reused the already-running dev server on `:3000` throughout — no server was
started or stopped by this work, and `npm run build` was never run.

## Journey coverage table

| Journey | Viewport(s) / theme | Result |
|---|---|---|
| Home → search → country tabs (Factbook, Civica Data, Constitution) | desktop, small-mobile, + dark-theme spot-check | Pass |
| Source / provenance (SourceDot on Factbook + Civica Data tabs) | desktop | Pass |
| Atlas map (SVG render, country paths, layer-switcher interaction) | desktop, small-mobile, + dark-theme spot-check | Pass |
| Compare (real two-country picker → comparison table) | desktop | Pass |
| Indicator history (Civica Data tab longitudinal table) | desktop | Pass |
| Constitution search (real form submit → highlighted passages) | desktop | Pass |
| Elections (index + electoral-systems explainer) | desktop | Pass |
| Organizations (index redirect + `/organizations/ecowas` detail) | desktop | Pass |
| The Record / blog (index + a real article) | desktop | Pass |
| Methodology + citation (`CiteAccordion` expand → APA/BibTeX tabs) | desktop | Pass |
| API docs (endpoint sections) | desktop | Pass |
| Download / export (Atlas bulk-export archive + manifest, read-only GET) | desktop (API context) | Pass |
| Licensing / contact / advisory board | desktop | Pass |
| 404 / error (real not-found UI, not a generic error page) | desktop | Pass |
| Embed (documented retirement contract) | desktop (API context) | Pass |

**Test count:** 23 tests across 3 files, **23/23 passing**, stable across two
consecutive full runs (default 6-worker and explicit 2-worker configurations).

## Findings

**No real reader-flow bugs were found.** One journey did not match the task
brief's literal wording and is documented rather than "fixed":

- **Embed journey.** The brief asked to assert `/embed/<slug>` "renders a
  compact widget." In the current app, `src/app/embed/[slug]/route.ts`
  intentionally returns **HTTP 410** with a fixed retirement notice for
  every slug — this is documented, correct, current behavior (see
  `/api-docs` → "Retired Widget Embed," which points readers at
  `/governance-evidence` as the successor). It is not a bug: Civica retired
  the scored embed widget when it retired country grading/scoring from the
  public product. The test (`qa-010-reader-journeys-access.spec.ts`, "embed"
  describe block) asserts the actual documented contract — 410 status, the
  literal retirement text, and the `/governance-evidence?country=<slug>`
  successor link — rather than assuming a live widget. No code change was
  made; this is a spec/brief mismatch, not an app defect.

No `INDEX_PROTECTED_FILES` (`src/lib/ci/index-change-control.ts`) needed to
be touched — this task only added test files.

## Read-only / no-paid-calls confirmation

- Every journey is a GET/navigation or a client-side interaction that reads
  existing data. No `POST`/`PATCH`/`DELETE` request is ever issued.
- The contact-page journey explicitly renders and asserts the form fields
  (`Name`, `Email`, `Message`) and the submit button's presence, but **never
  clicks submit** — no message is sent.
- The constitution-search and compare journeys submit real GET forms /
  `router.replace` URL updates only (both read-only, no server mutation).
- The download/export and embed journeys use Playwright's `request` API
  context with plain `GET`, never touching `/api/chat` or any model-backed
  endpoint — no paid Anthropic/DeepSeek/GLM call is ever triggered.
- No npm dependency was installed, no `package.json`/`plan/MASTER-CHECKLIST.md`
  /`plan/PROGRESS.md`/`src/lib/ci/claims-docs-gate.ts` edit was made, and no
  commit was created — only the three new spec files plus this evidence file.
