# QA-005 — public/admin/cron/API contract and authorization tests

Completed 2026-07-12. Three new test files close the gap between PLT-008's
route-inventory *declarations* (which control a route claims) and *proof*
that the control is actually wired and actually fires — plus a full-response
contract-shape sweep for the public `/api/v1/*` surface. All tests are
either DB-free static source assertions or read-only/no-write HTTP requests
against the already-running local dev server; nothing writes to the
database, and `/api/chat` is exercised only with inputs its own validation
rejects before any Anthropic call.

## What shipped

- **`src/lib/api/__tests__/route-authorization.test.ts`** (DB-free,
  `npm test`). For every `admin` / `cron` / `pulse-coding` entry in
  `src/lib/api/route-inventory/registry.ts`, reads the real `route.ts`
  source and asserts the declared guard is actually **called** (not just
  imported):
  - `cron-secret` → `requireCronAuth(` called in every one of the 39 cron
    routes.
  - `admin-session` → `getAdminSession(` called in every admin/pulse-coding
    route that declares it.
  - `pulse-coding-session` → `getPulseCodingSession(` /
    `getPulseCodingParticipantSession(` called in every pulse-coding route
    that declares it. (No prior scanner checked this control at all —
    `scripts/validate-route-inventory.ts`'s `scanControlMarkers` only has
    markers for `admin-session`/`cron-secret`, and only as a non-blocking
    warning.)
  - `credential-check` → the two login routes themselves
    (`api/admin/session`, `api/pulse-coding/session`) verify
    username+password / access-code, not just accept a cookie.
  - `oauth-bootstrap` → the Google sign-in start/callback pair sets and
    verifies the CSRF state cookie, and callback additionally gates session
    issuance on `isAllowedAdminGoogleAccount(`.
  - Re-asserts the two registry-documented exceptions (`admin/sign-out`,
    `pulse-coding/sign-out`) still carry zero controls **and** a non-empty
    explanatory note, so a future silent regression there is caught.
  - 3 negative fixtures prove the "called, not just imported" regexes
    actually discriminate.
  - **20 tests, all pass.**

- **`src/lib/api/__tests__/api-contract-shape.test.ts`** (DB-free,
  `npm test`). Extends `src/lib/api/contract/__tests__/contract.test.ts`
  (which proves registry/example completeness, param drift, and 9 negative
  fixtures against individual sub-schemas) with a full-envelope sweep: every
  `versioned: true` (`/api/v1/*`) route in `contract/registry.ts` is mapped
  by hand to its own top-level response schema in `contract/schemas.ts`,
  and its checked-in `contract/examples.ts` example is strict-parsed
  against that exact schema — proving the route↔example↔schema wiring
  itself, not just that *some* schema happens to accept the example.
  6 tests (completeness of the map, the full-sweep strict parse, and 4
  negative fixtures: mismatched sibling schema both directions, excess
  top-level field, missing required field, wrong-typed field).
  **6 tests, all pass.**

- **`e2e/qa-005-route-authorization.spec.ts`** (Playwright, `npm run
  test:e2e`, reuses the already-running dev server — never spawns a second
  one). Runtime complement to the two static files above: sends real,
  unauthenticated/malformed HTTP requests at representative routes from
  every class and asserts rejection. Deliberately lives under `e2e/`, not
  `src/**/*.test.ts` — the `"test"` npmScript in
  `src/lib/ci/claims-docs-gate.ts` runs `npm test` inside
  `validate:claims-docs`, which CI (`.github/workflows/claims-docs.yml`)
  runs with **no server on :3000**; `test:e2e` is not wired into any GitHub
  workflow, so this spec only runs when explicitly invoked against a live
  app, matching the QA-009 harness convention.
  **17 tests, all pass.**

## Route-class coverage table

| Exposure class (PLT-008) | Count | Static contract test | Runtime (live server) test | Notes |
|---|---|---|---|---|
| `admin` | 11 | `route-authorization.test.ts` — admin-session/credential-check/oauth-bootstrap guard-call proof for all 11 | `qa-005-route-authorization.spec.ts` — `GET /api/admin/contact`, `POST /api/admin/messages/:id`, `POST /api/admin/data-disputes/:id` all 401 with no cookie | sign-out route is the one documented, intentionally uncontrolled exception |
| `cron` | 39 | `route-authorization.test.ts` — `requireCronAuth(` call proof for all 39 | `qa-005-route-authorization.spec.ts` — `GET /api/cron/pulse/v2/ingest` (no bearer, wrong bearer) and `GET /api/cron/factbook/sync-wikidata` (no bearer), all 401 | |
| `pulse-coding` | 6 | `route-authorization.test.ts` — pulse-coding-session/admin-session/credential-check guard-call proof for all 6 | `qa-005-route-authorization.spec.ts` — `POST /api/pulse-coding/assignments/:id`, `POST /api/pulse-coding/adjudications/:assignmentId`, `POST /api/pulse-coding/admin/participants`, all 401 with no cookie | sign-out route is the second documented exception |
| `public-read` (`/api/v1/*`) | 36 (17 versioned GET routes registered in the API contract) | `api-contract-shape.test.ts` — every versioned route's example strict-parses its own full response schema | `qa-005-route-authorization.spec.ts` — positive control (`GET /api/v1/countries?as_of=live` → 200) plus the `as_of` validation contract (missing → 400, not 500) | the other `public-read` entries (non-`/api/v1` pages, sitemap, robots, etc.) are outside the API-contract surface QA-005 targets |
| `public-mutation` | 3 | pre-existing `contract.test.ts` param-drift coverage | `qa-005-route-authorization.spec.ts` — malformed/empty-body rejection for `POST /api/contact`, `POST /api/civica-index/corrections`, `POST /api/advisory-applications`, all 4xx never 500 | |
| `chat` | 1 | n/a (no public response schema; `/api/chat` is a streamed/plain-text chat reply, not a `/api/v1` contract route) | `qa-005-route-authorization.spec.ts` — empty message (400), malformed JSON (400), oversized message (413), all rejected **before** the Anthropic client is constructed/called — verified against source (`src/app/api/chat/route.ts`'s validation runs before any `client.messages.create`) | no paid model call is made anywhere in this test suite |
| `export` | 3 | pre-existing `contract.test.ts` (`isRightsBlockedExport`/shared CSV builder checks) | not re-tested here | intentionally `controls: ["public"]` by design (DAT-017/DAT-027 — rights are enforced at the data-filtering layer, not an auth gate); not an authorization gap |
| `embed` | 1 | n/a | not re-tested here | intentionally public (`controls: ["public"]`); no credential to test |

**Totals exercised by this task:** 100% of `admin` (11/11), `cron` (39/39),
and `pulse-coding` (6/6) routes get a static guard-call proof; representative
routes from every one of those three classes plus `public-mutation` and
`chat` get a live runtime rejection proof; all 17 versioned `/api/v1` GET
routes get a full-envelope contract-shape proof.

## Commands + output

```
$ npx tsc --noEmit
(clean exit, no output)

$ node --import tsx --test src/lib/api/__tests__/route-authorization.test.ts src/lib/api/__tests__/api-contract-shape.test.ts
ℹ tests 26
ℹ pass 26
ℹ fail 0

$ npm test        # full repo suite, includes the two new files above
ℹ tests 1282
ℹ pass 1282
ℹ fail 0
ℹ duration_ms ~24900

$ npm run test:e2e -- qa-005-route-authorization
Running 17 tests using 6 workers
17 passed (1.7s)
```

No npm script changes were needed: the two `src/lib/api/__tests__/*.test.ts`
files match the existing `npm test` glob (`"src/**/*.test.ts"`) automatically,
and the Playwright spec runs via the existing `npm run test:e2e` command
(`playwright test`, `testDir: "./e2e"`).

## Real findings

**No undocumented authorization gap was found.** Every `admin`/`cron`/
`pulse-coding` route that declares a guard control in the registry actually
calls that guard in its own source (static proof), and every representative
route tested against the live server correctly rejected an unauthenticated
or malformed request (runtime proof). The only uncontrolled-mutation
findings are the two pre-existing, registry-documented, intentionally-open
sign-out routes (`api/admin/sign-out/route.ts`,
`api/pulse-coding/sign-out/route.ts` — clearing a cookie needs no prior
session), which this task's tests re-assert stay documented rather than
silently drifting into an undisclosed gap.

One incidental, non-security observation surfaced while writing the runtime
spec: `POST /api/contact`'s per-IP rate limiter (5 requests / 10 minutes,
checked **before** body parsing) is tight enough that repeated manual/e2e
probing from the same IP can legitimately return 429 instead of exercising
the malformed-JSON branch. The spec's assertion for that route accepts
either a 400 (with the "Invalid JSON" message) or a 429 (with a
`Retry-After` header) and always rejects a 500 — both outcomes are correct
defense-in-depth, so this is documented in the spec's own comment rather
than being a flaky test or a masked bug.
