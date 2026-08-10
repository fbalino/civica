# DAT-036 — authorized production publisher refresh (2026-08-09/10 UTC)

Authority: `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md`. Named Atlas
release: `atlas-wikidata-refresh-20260809-v1`. Retained public correction
record: `correction_log` id `4ffdc3a2-012a-4256-ba0c-c4395aab7a4b`
(created `in_review` before the run; resolved `resolved_corrected`
2026-08-10 with a public disposition naming the release, counts, and the
disclosed residual row).

## Runbook execution

1. Fresh zero-write plan before the run: 1,270 current Wikidata rows, all
   publisher-refresh-bound, 0 repairable (matching the dormant runbook's
   expectation, so `--apply` was correctly useless and the full publisher
   refresh ran instead).
2. Full read-only dry run, with the value deltas reviewed separately and
   retained in `refresh-dry-run-deltas.json`: 1,264 proposed admissions,
   1,050 values unchanged, 214 ordinary publisher value revisions riding
   along as `routine_refresh` source updates (largest: Afghanistan
   unemployment 8.5 → 13.4), 0 new pairs, 5 transient SPARQL 502s, and one
   genuinely no-longer-admissible pair (Botswana GDP per capita).
3. Authorized apply with `CIVICA_ATLAS_RELEASE_ID=atlas-wikidata-refresh-20260809-v1`:
   1,268 (jurisdiction, fact-key) pairs written across 195 jurisdictions in
   2,988 s with one transient failure (Chad unemployment), so freshness
   correctly did not stamp; the targeted Chad rerun then applied cleanly and
   stamped `wikidata` freshness through the sanctioned helper. The run used
   the corrected SPARQL retrieval that captures explicit Wikibase
   `timePrecision` before any write. Russia's rows were re-queried from the
   correct entity (Q159) after the ATL-010 identity repair.

## Post-run verification (all required gates)

- Re-run zero-write plan: 1,270 examined → **1,269 already correct**, 0
  repairable, **1 publisher-refresh-bound** residual: Botswana
  `gdp_per_capita_usd`, a fact key the current pipeline no longer syncs, so
  no fresh publisher query can repair its legacy snapshot; it remains
  disclosed rather than repaired by inference. The plan artifact and
  validator now record the healthy state explicitly (`alreadyCorrectCount`).
- DAT-034 confirmed samples re-verified live: Malaysia `population_total`
  year precision + `as_of NULL`; Rwanda `life_expectancy_years` year
  precision + `as_of NULL`; Sweden `population_total` month precision
  (2025-04) + `as_of NULL`.
- 1,269 append-only `atlas_entity_change_history` fact events exist under
  the named release, every one carrying a `value_json` and/or `as_of` diff;
  the correction record links the run through the named release and its
  internal notes (routine_refresh events cannot carry a correction-log id by
  contract; the planner's `--apply` correction path had zero eligible rows).
- Gates: `validate:wikidata-date-precision`, strict live
  `validate:release-quality` (all nine families PASS, including
  row-delta and source-age), `validate:temporal-metadata`,
  `validate:fact-coverage` (regenerated), `validate:api-docs`,
  `validate:atlas-change-history-writers`, `validate:data-value-states`,
  `validate:sync-freshness`, and `validate:source-coverage` (regenerated)
  all pass.
- The immutable `atlas-2026-07-11` G2 release was not touched; no new
  frozen vintage was cut in this wave (a later named vintage will carry the
  corrected structured dates, per the release note).

## Incidental disclosure

During the ATL-010 leg of the same wave, a writer type-probe inserted and
immediately deleted one junk person row; the research-evidence retention
ledger recorded both operations and one stray append-only history event with
release id `type-probe` remains (see
`plan/evidence/ATL-010/production-refresh-2026-08-09.md`).
