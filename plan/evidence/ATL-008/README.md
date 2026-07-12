# ATL-008 — election research utilities

ATL-008 turns the checked election corpus into a reproducible research surface
without widening what the evidence or source rights support. The calendar,
historical timeline, Compare module, country legislature, electoral-system
explainer, and new export route all fail closed against the same checked
`election-corpus-audit/v1` rows and live content fingerprints.

## Reader utilities

- `/elections` presents 17 tentative source-dated future events separately from
  168 collapsed, year-only term projections.
- The historical timeline exposes all 555 qualified conceptual events. Its 25
  additional chamber contests remain attached to their conceptual event, and
  events without compiled results say so directly.
- The country selector uses the complete Atlas jurisdiction catalog. Sparse
  jurisdictions now distinguish qualified history, compiled-result coverage,
  source-dated future coverage, projection coverage, quarantined-only evidence,
  and no qualified record.
- Calendar dates are explicitly date-only: no event time or source time zone is
  inferred. UTC is only a browser-rendering guard. Tentative dates and derived
  years retain distinct labels.
- Compare and country legislature queries carry independent outage states, so a
  failed election query cannot erase other modules or masquerade as zero
  coverage.
- Electoral-system labels render only with exact IPU statement evidence. The
  five unsupported manual presidential labels and copied projection labels fail
  closed. The explainer links IPU field documentation, ACE, and International
  IDEA, marks IPU rights review pending, supports keyboard-accessible tabs, and
  makes every classification inspectable.

## Research export

`/api/v1/elections?format=json|csv` uses one batch-qualified query and the same
live fingerprint guard as the reader. It supports jurisdiction, election type,
temporal class, source status, jurisdiction status, date range, result, and
turnout filters.

The public export emits only qualified Wikidata event rows with verified CC0
export permission and an exact source URL. IPU event rows, IPU-derived
projections, IDEA turnout, IPU results, and unsupported electoral-system fields
are withheld rather than reassigned or silently dropped. JSON and CSV carry the
same row membership and explicit source/field withholding summaries. IPU
percentages are described as derived seat share, never vote share.

Every emitted date carries value, basis, precision, role, temporal class,
publisher status, `time: null`, `timeZone: null`, and the audit version/as-of
date. The endpoint uses the checked artifact generation time so the same
qualified database state yields deterministic output bytes.

## Scope correction discovered during acceptance testing

Export smoke testing exposed a formerly qualified U.S. Virgin Islands election
assigned to the United States. The upstream ATL-007 identity gate was corrected
generally, not patched in the API: Wikidata P17 must match the assigned country,
and any explicit P1001 jurisdiction scope must also match. Six formerly public
rows are now quarantined, including narrower-scope elections in the U.S. Virgin
Islands, Somaliland, the Basque Country, and Bougainville, plus two conflicting
publisher records. The corrected release has 572 conceptual events, 25 related
contests, 88 quarantined rows, 313 public turnout-eligible rows, and 174 public
result-eligible rows. Full correction evidence remains in
`plan/evidence/ATL-007/`.

## Acceptance evidence

The following focused checks pass:

```text
npx tsc --noEmit
npx eslint <ATL-008 changed TypeScript/TSX files>
npm run validate:design-tokens
npm run validate:numeric-claims
npm run validate:api-docs
npm run validate:rights-manifest
npm run validate:rights-claims
npm run validate:election-jurisdiction-identity
npm run validate:election-corpus-audit
node --import tsx --test \
  src/lib/elections/jurisdiction-scope.test.ts \
  src/lib/elections/corpus-audit.test.ts \
  src/lib/elections/corpus-audit-runtime.test.ts \
  src/lib/elections/research-export.test.ts \
  src/lib/elections/research-query-contract.test.ts \
  src/lib/elections/atl008-sparse-surfaces.test.ts
```

Browser QA on the local application verified:

- the 572/193/17/168 release summary and separate tentative/projection labels;
- the complete 555-event timeline and resultless event state;
- Eritrea's one qualified historical record, no compiled results, no future
  date, and no projection state;
- Japan–France Compare date-only disclosure, tentative dates, projections, and
  field-level result/turnout sources;
- Eritrea's visible country-legislature timing and result-coverage state;
- six keyboard-addressable system tabs, working expand/collapse controls, and
  linked official references; and
- no browser console errors on `/elections`.

The final aggregate test/build, live audit fingerprint, and append-only Index
change-control snapshot are recorded after the integrated tree is settled.
