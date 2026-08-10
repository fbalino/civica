# DAT-036 — Wikidata publisher-date precision

Status: complete — the authorized publisher refresh ran 2026-08-09/10 under
named release `atlas-wikidata-refresh-20260809-v1` with retained public
correction record `4ffdc3a2-012a-4256-ba0c-c4395aab7a4b`; 1,269 of 1,270
affected rows are repaired and one residual row remains disclosed as
publisher-refresh-bound. See `production-repair-2026-08-09.md`.

## What is fixed

- The Wikidata SPARQL query now retrieves the Wikibase time-value node and its
  explicit precision (`9=year`, `10=month`, `11=day`).
- The fact writer retains `value_json.publisherDate` with the publisher's
  honest year/month/day granularity. Only true day precision populates `as_of`;
  year and month precision no longer manufacture January 1 or the first day of
  a month.
- Public country provenance and alternates expose `publisherDate`; the reader
  prints both the date and its precision.
- The frozen Atlas export already projects `value_json`. Future vintages
  therefore carry the structured precision without changing the immutable G2
  release.
- The public Atlas change-history allowlist and atomic fact writer now retain
  `value_json` diffs, so the repair cannot silently overwrite structured date
  evidence.

## Live scope captured 2026-07-23

The zero-write plan examined 1,270 current Wikidata fact rows. None of their
legacy snapshots retained explicit Wikibase time precision. A valid-looking
date such as `2022-01-01` is therefore ambiguous: Wikidata's old SPARQL scalar
projection may have normalized a year-precision value to January 1.

The plan deliberately classifies all 1,270 rows as requiring a fresh publisher
query rather than guessing. DAT-034 independently confirmed three sample
defects against current official entity evidence:

- Malaysia `population_total`: year precision stored as `2025-01-01`
- Rwanda `life_expectancy_years`: year precision stored as `2025-01-01`
- Sweden `population_total`: month precision stored as `2025-04-01`

The checked machine-readable plan is `live-repair-plan.json`. It records no
production write.

## Remaining authority gate

Follow `repair-runbook.md`. The owner must authorize a named release, create or
approve the public correction-log record, and authorize the production
publisher refresh. The immutable `atlas-2026-07-11` G2 release is not rewritten;
the corrected current rows and next frozen vintage supersede it transparently.

## Verification

```sh
npm run validate:wikidata-date-precision
npm run validate:api-docs
npm run validate:atlas-change-history-writers
npm run validate:design-tokens
npm run typecheck
```
