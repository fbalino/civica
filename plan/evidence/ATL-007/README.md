# ATL-007 — qualified election corpus

ATL-007 preserves the 915-row election baseline and adds a deterministic
`election-corpus-audit/v1` qualification layer. Every row is checked for
jurisdiction scope, event and chamber identity, type, date basis and precision,
lifecycle status, temporal class, source, statement license, retrieval age,
field-level evidence, duplicate/collision risk, and source-rights posture.

Jurisdiction assignment is independently bound by
`election-jurisdiction-identity/v1`: Wikidata event-country P17 claims and IPU
election/chamber country codes match 894 rows. The remaining 21 rows have no
retained publisher identity evidence and are explicitly quarantined; no
publisher-to-Civica jurisdiction mismatch remains. Future Wikidata dates are
labelled tentative because a date claim is not proof of an official schedule.

The checked release contains 578 qualified conceptual events plus 25 additional
qualified chamber-contest rows. It covers 193 sovereign jurisdictions and two
limited-recognition jurisdictions. Eighty-two rows remain stored but are
quarantined. Of the future data, 17 conceptual events have source-dated dates;
230 term-derived projection rows reduce to 215 exact-date groups and 168 public
country/type estimates. The public calendar shows only the earliest estimate
for a country and election type. Named chamber projections remain available on
the comparison and country surfaces.

Field evidence fails closed. The public result view admits 176 results-eligible
rows, and 342 turnout values have their own eligible statement evidence.
Unproven turnout and result payloads remain stored for remediation but are not
rendered. IPU Parline and International IDEA remain outside public bulk export
while DAT-003 rights review is pending.

The live database matched the checked 915-row fingerprint
`1e5679b6ea2a6ce90386c62f6fb677ca5f5ab845c02b6d67749822b733271d95`.
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

Final release evidence:

```text
npm test
  965 tests passed

npm run validate:index-change-control:run
  v27 passed all six declared Index safeguards
  snapshot: 3e116b106a46fdc8638c68d91d2a7224451b57414aeabb8e41417ae8d052a4ba

npm run build
  965 tests passed inside the aggregate claims/documentation gate
  105/105 static pages generated
  all data, rights, research, claims, documentation, and metadata gates passed
```

The build retained the pre-existing Turbopack whole-project tracing warning
from `next.config.ts`; ATL-007 introduced no new build warning.
