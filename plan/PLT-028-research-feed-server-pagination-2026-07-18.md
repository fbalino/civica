# PLT-028 — server-bound research-feed pagination

**Status:** Complete
**Completed:** 2026-07-18

## Scope and decision

PLT-028 closes the reader-side high-cardinality feed problem identified in
the readiness audit. The public Pulse changelog and the comparable public
reconciliation-disputes log now apply filters, sort, and pagination at the
server/query boundary. Their clients receive only one bounded page plus small,
explicit metadata; neither client filters or slices a full research feed.

## Pulse changelog

- `searchParams` is parsed into the typed, URL-addressable country,
  dimension, severity, review-state, and page contract in
  `src/app/(reader)/civica-index/pulse-changelog/query.ts`.
- The page issues exactly one `getPulseV2Changelog()` event request with a
  25-event page limit and offset. Its one-row cursor sentinel stays inside the
  query helper and is represented to the client only as `hasMore`.
- The country selector is bounded to 300 names and is metadata, not event
  data. The client performs URL navigation only; it no longer receives two
  2,500-row result sets or calls `.filter()`/`.slice()` on events.

## Comparable public disputes feed

- `/country/methodology/reconciliation/disputes` has an equivalent typed URL
  contract for status, kind, fact key, severity, fact group, source pair, age,
  sort, and page.
- `getPublicDisputeFeed()` now projects the fact-key severity registry into a
  SQL CTE, applies all filters in SQL, ranks pairwise rows, selects at most 50
  consolidated `(jurisdiction, fact_key)` conflicts, then returns the selected
  groups only. Exact matching-pair/group counts and the two top-eight filter
  distributions are bounded metadata.
- The client renders server-provided groups and uses router navigation; it no
  longer filters, sorts, groups, or pages a 2,000-row client payload.
- Out-of-range dispute pages redirect to the final valid page after the server
  has an exact group count.

## Budgets and regression boundaries

`civica-query-budget/v1` now records the two reader profiles:

| Reader | Page ceiling | Initial response ceiling | Current isolated-dev response |
| --- | ---: | ---: | ---: |
| Pulse changelog | 25 events | 1,048,576 bytes | 839,715 bytes |
| Public disputes | 50 consolidated conflicts | 1,048,576 bytes | 970,810 bytes |

The response values above were measured from the initial HTML/RSC document on
2026-07-18 with a detached worktree at `localhost:3100`; the real-browser
tests enforce the same 1 MiB ceilings. They are response-size checks, not a
claim about production network latency. Both reader budget profiles have
declared result ceilings and 500 ms database execution budgets in the shared
static contract; `npm run validate:query-budgets` confirms their source paths,
indexes, domains, and bounds.

The pure page-contract tests use 5,000-element fixtures and fail closed if a
server result exceeds the declared page ceiling. This protects the RSC boundary
against a future query regression before the client can serialize a full feed.

## Verification

- `node --import tsx --test src/app/(reader)/civica-index/pulse-changelog/query.test.ts src/app/(reader)/country/methodology/reconciliation/disputes/query.test.ts src/lib/db/__tests__/public-disputes-redaction.test.ts`
- `npm run validate:query-budgets`
- `npx tsc --noEmit`
- `npm run validate:design-tokens`
- `npm run validate:numeric-claims`
- `E2E_BASE_URL=http://localhost:3100 npm run test:e2e -- e2e/plt-028-server-pagination.spec.ts e2e/plt-028-disputes-server-pagination.spec.ts` — 2/2 Chromium tests passed in an isolated worktree. The server log recorded Pulse page/filter/review and dispute status/sort requests; no page, console, request, or HTTP failures occurred.
- `git diff --check`

`npm run validate:claims-docs` completed all preceding claim/documentation
validators but its full unit-test child remains blocked by the pre-existing,
unrelated `atl-014-source-native-compare-presentation` documentation-evidence
drift at `plan/ATL-014-source-native-compare-2026-07-18.md`. PLT-028 neither
created nor modified that file.

No production database write, deployment, or paid-model call was made.
