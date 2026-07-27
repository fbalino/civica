# ATL-026 — Conditions component provenance plan

## Objective

Close the Conditions decomposition gap before the later release-freezing,
construct-validation, and public-explorer tasks. A stored Conditions score must
be explainable as named source observations, including each component's native
value, reference year, source/lineage, availability state, and whether it was
included in the calculation.

## Confirmed starting defect

`scripts/ingest-conditions-economic.ts` currently selects the latest available
value independently for inflation, unemployment, and GDP growth. It accepts two
of three inputs, then stores only one `datasetYear`: the maximum component
year. The stored score therefore cannot reveal a mixed-year calculation or the
missing component. HDI and GPI each copy one opaque source score into the same
score table, so their component-level lineage is also not queryable.

## Intended contract

1. Persist one immutable component record for every declared input considered
   for a Conditions score, including unavailable inputs.
2. Record native value/unit, reference year, source and lineage fields,
   availability/missingness reason, and an explicit inclusion decision.
3. Adopt a strict alignment rule for the current economic recipe: all included
   components must share one reference year. Mixed-year candidate sets are
   refused rather than silently relabelled. A missing component remains stored
   as not observed and the score is unavailable unless a future, versioned
   method explicitly permits it.
4. Retain score-level lineage and add a calculation-level alignment label so
   readers and later release work cannot mistake the newest component year for
   a common vintage.
5. Extend the writer, queries, fixtures, and validator so malformed/mixed-year
   writes fail before source freshness is stamped.

## Boundaries

- No new public Conditions explorer or release-distribution work here; those
  are ATL-027 and ATL-029.
- No claim that the economic-stability construct is valid; ATL-028 owns that
  empirical/theory decision.
- Do not run live source ingestion or mutate Neon until the migration is
  explicitly authorized and its zero-write plan has been reviewed.

## Verification target

- DB-free fixtures cover aligned, mixed-year-refused, missing, and no-score
  cases for all three dimensions.
- Schema/migration/dictionary/data-value-state validation and TypeScript pass.
- Existing Conditions golden tests continue to prove no cross-dimension
  headline composite is produced.

## Implemented contract

- `conditions-components/v1` stores a calculation identity and one component
  ledger row for each required input. The ledger retains native value/unit,
  reference year, source/indicator lineage, data-value state/reason, and the
  inclusion decision.
- The current alignment policy is
  `all-components-same-reference-year/v1`. Economic calculations persist a
  `mixed_year_refused` or `missing_component` ledger when they cannot produce
  an aligned score; score/reference-year fields are then null.
- HDI and GPI inputs are pinned to their currently recorded `v1.0` source
  method. The read path selects only aligned, decomposition-backed scores and
  exposes a separate internal component-ledger query.
- Migration `0040_closed_young_avengers` is additive, retains updates/deletes
  in the research-evidence ledger, and leaves historic opaque Conditions rows
  intact but outside the new read path.

## Controlled rollout status

- A 2026-07-18 zero-write configured-Neon preflight found the two new ledger
  relations absent, 331 historic Conditions score rows, and 79,465 retained
  evidence-history rows. No configured-database mutation or source ingestion
  was performed.
- A fresh disposable PostgreSQL 17.9 catalog applied the complete checked
  authoritative chain through `0040`; the resulting schema fingerprint is
  `dd71ee71e10933f7ad4b4699a14e10458d8def41cf9d94399677804ef0fa64da`.
- The remaining action is the owner-operated staging rehearsal, then an
  authorized production migration and Conditions ingestion. This task remains
  unchecked until that evidence proves actual rows are decomposable in the
  configured environment.
