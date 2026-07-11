# DAT-020 — Domain source-coverage dashboard

## Outcome

DAT-020 is complete. `atlas-domain-coverage/v1` publishes one checked report
for elections, constitutions, offices, people, parties, organizations, bills,
indicators, and images at `/methodology/source-coverage` and
`/api/source-coverage`.

Every row carries:

- record and sovereign-state jurisdiction counts;
- measured field-completeness counts and percentages;
- source families and each source's last successful run;
- the domain's latest successful run, or an explicit unrecorded state;
- known gaps, reviewed thresholds, derived alerts, and current/attention status.

The current snapshot contains nine domains: three current, six requiring
attention, and eleven alerts. Notable open alerts include party coverage at
141/194 sovereign states, bills at 6/194, sparse office/person identifiers,
and no recorded run timestamp for the manually curated organization seed.

## Verification

- `npm run generate:source-coverage` generated the checked live snapshot.
- `npm run audit:source-coverage:live` reproduced it exactly from Neon.
- `npm run validate:source-coverage` proved domain closure, count bounds,
  completeness, source rows, gap disclosures, and deterministic alerts.
- Three focused fixtures cover canonical nine-domain construction, all four
  alert families, missing domains, impossible counts, and absent gap prose.
- 622/622 repository tests passed and the production build completed.
- Design-token, metadata, public-claim, mutable-number, TypeScript, ESLint, and
  aggregate claims/documentation gates passed.
- The reader page passed desktop dark/light and 390px mobile browser review
  without horizontal page overflow or console warnings. The JSON route returned
  HTTP 200 with the checked schema, all nine domains, and public caching.
