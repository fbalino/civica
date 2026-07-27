# ATL-007 — qualified election corpus

ATL-007 preserves the 915-row election baseline and adds a deterministic
`election-corpus-audit/v1` qualification layer. Every row is checked for
jurisdiction scope, event and chamber identity, type, date basis and precision,
lifecycle status, temporal class, source, statement license, retrieval age,
field-level evidence, duplicate/collision risk, and source-rights posture.

Jurisdiction assignment is independently bound by
`election-jurisdiction-identity/v2`: Wikidata event-country P17 and explicit
P1001 (applies to jurisdiction) claims are checked together, while IPU
election/chamber country codes remain the legislative identity path. Publisher
identity matches 877 rows. Twenty-one rows have no retained identity evidence
and 17 carry conflicting publisher jurisdiction scope; both classes are
explicitly quarantined. Future Wikidata dates are labelled tentative because a
date claim is not proof of an official schedule.

The checked release contains 572 qualified conceptual events plus 25 additional
qualified chamber-contest rows. It covers 193 sovereign jurisdictions and two
limited-recognition jurisdictions. Eighty-eight rows remain stored but are
quarantined. Of the future data, 17 conceptual events have source-dated dates;
230 term-derived projection rows reduce to 215 exact-date groups and 168 public
country/type estimates. The public calendar shows only the earliest estimate
for a country and election type. Named chamber projections remain available on
the comparison and country surfaces.

Field evidence fails closed. The qualified public corpus admits 174
results-eligible rows, and 313 turnout values have their own eligible statement
evidence. These counts exclude evidence retained only on quarantined rows.
Unproven turnout and result payloads remain stored for remediation but are not
rendered. IPU Parline and International IDEA remain outside public bulk export
while DAT-003 rights review is pending.

The explicit-scope gate removed six previously qualified rows: elections scoped
by Wikidata to the U.S. Virgin Islands, Somaliland, the Basque Country, and
Bougainville, plus Lebanese and Icelandic rows whose P1001 claims conflict with
their assigned national jurisdictions. The first four are demonstrably
dependent-territory, de facto, autonomous, or subnational elections. The latter
two remain quarantined as publisher-data conflicts rather than being guessed
back into the national corpus. Eleven other P1001 conflicts were already
quarantined by existing rules.

The live database matched the checked 915-row fingerprint
`a9d59a25bdc1451f22c97e3fc7c968fbf6bd0cc7a8961ffcae32790b9a432e89`.
The writer's fallback identity now includes the government body, preventing
same-day bicameral contests from merging.

Browser checks covered the election calendar and filters, Japan's country
record, and a Japan–France comparison in both themes. The calendar had no
horizontal overflow, duplicate unlabeled projection cards were consolidated,
and sourced dates and field values exposed separate provenance indicators.
No deployment, database write, schema migration, or outreach occurred.

Focused validation:

```text
npx tsc --noEmit
npm run audit:election-corpus:live
npm run validate:election-corpus-audit
npm run audit:election-jurisdiction-identity:live
npm run validate:election-jurisdiction-identity
npm run audit:source-coverage:live
npm run validate:source-coverage
npm run validate:atlas-surface-data-matrix
npm run validate:public-claims
npm run validate:design-tokens
node --import tsx --test \
  src/lib/elections/corpus-audit.test.ts \
  src/lib/elections/corpus-audit-runtime.test.ts \
  src/lib/elections/__tests__/writer-repeatability.test.ts
```

The identity-scope correction is entirely read-side: no database row, source statement, or
schema is rewritten. The checked artifacts and public qualification guards
change together.

Correction validation results (2026-07-12):

```text
npx tsc --noEmit
  passed

scoped ESLint
  passed

targeted election tests
  31 passed, 0 failed

npm run validate:election-jurisdiction-identity
  877 matched; 21 missing; 17 conflicting

npm run validate:election-corpus-audit
  572 qualified events; 88 quarantined rows

npm run audit:election-jurisdiction-identity:live
npm run audit:election-corpus:live
  passed; 915 rows match fingerprint
  a9d59a25bdc1451f22c97e3fc7c968fbf6bd0cc7a8961ffcae32790b9a432e89

npm run validate:source-coverage
npm run validate:atlas-surface-data-matrix
npm run validate:public-claims
  passed
```

The strict live source-coverage comparison still reports that the broader live
domain report differs from its checked artifact. This correction does not
change source-domain coverage, so that separate live-report refresh remains an
integration item. The aggregate test/build and append-only Index
change-control record will be rerun after the concurrent ATL-008 work settles,
so their hashes bind the final integrated tree rather than an intermediate one.
