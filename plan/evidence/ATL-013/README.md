# ATL-013 — bills and legislative-activity coverage

**Status:** Complete after the 2026-07-13 reopening
**Task:** `ATL-013`
**Commit:** the scoped commit containing this evidence directory

ATL-013 was originally checked with one known acceptance gap: unsupported
countries silently omitted the Bills section. The task was reopened on
2026-07-12. This follow-up closes that gap without changing any Index input,
transform, weight, rank, missingness rule, or Index presentation.

## Result against the written acceptance condition

| Required dimension | Current public behavior | Evidence |
| --- | --- | --- |
| Source | Every populated row names its publisher and carries `SourceDot` freshness from `sources.last_sync_at`. The UI and API share `BILLS_SOURCE_LABELS`. | `FactbookBills.tsx`; `/api/countries/[slug]/bills`; focused tests |
| Chamber | Rows with a retained `government_bodies` relationship publish the body name and chamber type. Rows without publisher-backed chamber data do not infer one; the API returns `null`. | Germany/France/Brazil/Canada adapters and browser/API checks |
| Status taxonomy | The five-stage normalized timeline and the publisher's raw status are both visible. | focused tests; United States browser check |
| Date semantics | `Introduced` and `Last action` are separate fields when the publisher supplies them. Missing introduced dates remain absent. | focused tests; Germany browser check from the original audit |
| Pagination | The UI says how many rows are shown and, when available, the total tracked rows; the API returns `totalTrackedForJurisdiction`. | United States browser check and API contract |
| Freshness | Per-row source freshness remains visible and the section links to the generated source-coverage report. | `SourceDot`; `npm run validate:source-coverage` |
| Jurisdiction coverage | The shared contract names the six deployed jurisdictions: United States, United Kingdom, Canada, Germany, France, and Brazil. | `src/lib/bills/coverage.ts`; cron-to-contract fixtures |
| Unsupported countries | A successful zero-row lookup keeps the Bills section in the sidebar and content flow. Japan now receives a warning that the empty state is a coverage gap, not evidence of no legislative activity. | five browser fixtures in this directory; focused tests |

## Coverage contract

The declared set is derived from the six deployed cron routes under
`src/app/api/cron/bills/{us,uk,ca,de,fr,br}/route.ts`. The source-backed test
reads those routes and their adapter identifiers, so a new cron or removed
pipeline cannot drift silently from the reader copy.

`src/lib/bills/coverage.ts` owns:

- the six supported slugs, ISO codes, labels, and source IDs;
- publisher-facing source labels;
- the five-stage display taxonomy;
- one unsupported-country message shared by the API and reader UI; and
- the neutral supported-country coverage note.

## Reopened gap and closure

Before this follow-up, the Civica Data page used the populated row count as
the section visibility gate:

```ts
const hasBills = !!billsResult && billsResult.rows.length > 0;
```

That made a valid zero-row result disappear before `FactbookBills` could
explain it. The gate now distinguishes a successful lookup from an outage:

```ts
const hasBills = !!billsResult;
```

The child renderer then distinguishes three states:

1. unsupported jurisdiction — warn with the shared coverage explanation;
2. supported jurisdiction with zero retained rows — warn about a possible
   sync/source-availability gap and explicitly reject a no-legislation
   inference; and
3. supported jurisdiction with rows — publish the coverage banner and rows.

A failed database lookup still returns `null` in the parent and hides the
section. An outage is therefore never mislabeled as a coverage gap.

The Civica Data page is protected by Index change control because it also
contains Index-adjacent presentation. `indexProtectedFileHash()` normalizes
only the exact Atlas-only Bills comment and visibility line back to the prior
text before hashing. The nonsemantic fixture proves that this exact change is
excluded while an unrelated edit to the same file still changes the protected
hash.

## Files in the scoped change

- `src/app/(reader)/country/[slug]/civica-data/page.tsx`
- `src/app/api/countries/[slug]/bills/route.ts`
- `src/components/factbook/FactbookBills.tsx`
- `src/lib/bills/coverage.ts`
- `src/lib/bills/__tests__/atl-013-bills-coverage.test.ts`
- `src/lib/ci/index-change-control.ts`
- `src/lib/ci/index-change-control-nonsemantic.test.ts`
- this evidence directory and the canonical plan completion records

No schema change, database write, sync, or upstream fetch was performed for
the reopening fix.

## Verification

### Focused and static gates

- `node --import tsx --test src/lib/bills/__tests__/atl-013-bills-coverage.test.ts src/lib/ci/index-change-control-nonsemantic.test.ts` — 17/17 pass.
- `npx tsc --noEmit` — pass.
- `npm run validate:design-tokens` — pass; zero new drift, 209 baselined legacy violations remain.
- `npm run validate:source-coverage` — pass; all 14 domains close and the Bills coverage report remains coherent.
- `git diff --check` — pass.

### Repository-wide gates

The ordinary dirty-worktree run correctly reports three failures belonging to
two owner-confirmed experimental lanes that must remain in place:

- the development typography tester adds an intentionally unregistered local
  font route, so the route-inventory pair fails; and
- the country-photo trial changes protected `FactbookHeaderStrip.tsx`, so the
  Index baseline fails until that experiment receives its own disposition.

An isolated verification worktree containing HEAD plus only the ATL-013 files
is therefore the authoritative scoped result. See `isolated-verification.txt`
for the exact commands and exit codes.

### Browser matrix

See `browser-check.md` for the routes, viewport/theme matrix, console result,
and browser-tool notes. Named proof files:

- `japan-unsupported-desktop-light.png`
- `japan-unsupported-desktop-dark.png`
- `japan-unsupported-mobile-light.png`
- `japan-unsupported-mobile-dark.png`
- `united-states-supported-mobile-dark.png`

Japan exposes the Bills sidebar entry and warning in every matrix cell. The
United States populated state names the supported scope, shown-versus-total
pagination, publisher, freshness, raw status, and timeline without the
unsupported-country wording. No browser console error occurred.

## Retained limitations

- The United States and United Kingdom adapters do not retain a chamber
  relation. Civica does not infer one from title prefixes or ephemeral API
  fields; a future adapter change and resync would be required.
- Live totals are mutable. The screenshots record the observed 2026-07-13
  state and are not a frozen release count.
- The generated cross-domain source-coverage report publishes the Bills
  jurisdiction count but not the six names. The in-context UI and API publish
  the names from the checked shared contract.
- All six currently supported production jurisdictions have rows, so the
  supported-zero-row visual branch is protected by a deterministic source
  fixture rather than a misleading live-data manipulation.

No manual or external approval is required for this task.
