# ATL-010 — world leaders directory

Prepared 2026-07-23; completed 2026-08-09/10 under the owner-authorized
named-release refresh (`atlas-wikidata-refresh-20260809-v1`, authority
`plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`). The refresh run record is
`production-refresh-2026-08-09.md`; the recaptured zero-write audit reports
0 roster discrepancies and `releaseReady: true`; the checked release is
`leaders-2026-08-10` (389 records, 327 people, 197 jurisdictions, status
`ready`); `/leaders` is live in the footer and sitemap. Samoa's head of
government remains a disclosed upstream-ambiguous exclusion published as
explicit noncoverage. The sections below retain the preparation history.

## What shipped

- `/leaders` contains the searchable, filterable, sortable implementation for
  current heads of state and heads of government.
- Inclusion requires a current `terms` row joined to a principal `offices` row,
  a person, a jurisdiction, and a retained Wikidata statement for that exact
  term. An office/person row without statement evidence cannot enter.
- When activated, every row links to the country profile, its leadership section, the upstream
  Wikidata record, and the stable person-citation API.
- Source retrieval time and the source-rights/vintage disclosure are exposed.
  Wikidata has no named dataset vintage in this pipeline, so the UI says that
  rather than inventing one.
- Acting, interim, and caretaker are derived only from explicit source office
  wording. Co-leadership requires multiple verified current people in the same
  jurisdiction/role. Dual office requires the same verified person in both
  principal roles.
- Portraits are not part of the inclusion condition. Missing portraits, dates,
  capacity labels, or records remain missing and never become claims that a
  jurisdiction has no leader.

## Why publication is blocked

The first real browser pass exposed stale rows, including Australia retaining
Peter Cosgrove as head of state. The root cause was an order-dependent source
sync: it processed only the first SPARQL row per state, even when Wikidata
returned a preferred current statement later in the result set.

The resolver now follows the official Wikidata rank contract verified on
2026-07-23 at <https://www.wikidata.org/wiki/Help:Ranking>: preferred
statement(s) win, multiple preferred values remain explicit co-leadership,
deprecated values never enter, and multiple un-ended normal-rank claims fail
closed instead of becoming an arbitrary current selection. Complete
jurisdiction-role sets are reconciled together, so legitimate co-leadership is
not erased by per-row upserts.

The zero-write live audit in `production-refresh-plan.json` compared the
current ranked Wikidata selection with the retained database and found:

- 89 jurisdiction-role roster discrepancies;
- one unresolved multiple-normal-rank role (Samoa head of government);
- 391 source-selected office records versus 314 retained records; and
- zero current retained rows lacking Wikidata person/jurisdiction identity.

`data/leaders-directory-release.v1.json` preserves the 314-row retained
identity set and its hash for reconciliation, but it is explicitly marked
`blocked_source_refresh`. The direct route shows a publication-paused notice,
does not query/render the stale roster, and is absent from navigation, footer,
and sitemap.

## Required authorized action

Run the hardened `sync:wikidata` pipeline against production with a named
Atlas release, inspect the resulting change history, recapture both artifacts,
rerun `validate:leaders-directory:live`, repeat browser QA, and only then
change the release publication status to `ready` and add `/leaders` to
navigation/footer/sitemap. That database mutation and public activation need
owner production authority and were not performed here.

## Verification

```text
npm run validate:leaders-directory
npm run audit:leaders-directory:live
npm run validate:design-tokens
npx tsc --noEmit
npx eslint src/app/(reader)/leaders/page.tsx \
  src/components/leaders/WorldLeadersDirectoryClient.tsx \
  src/components/editorial/SearchField.tsx \
  src/lib/leaders/directory.ts src/lib/leaders/query.ts \
  src/lib/leaders/release.ts scripts/validate-leaders-directory.ts \
  scripts/generate-leaders-directory-release.ts
```

The implementation was browser-tested before the data-quality block was
introduced: the live 314-row table, Uruguay search, role filter, descending
country sort, 314 source/citation links, light/dark switch, and 360px
horizontal-overflow check all passed with no console errors. A second check
verifies the current safe publication-paused route and absence of stale rows.
See `browser-verification.md`.
