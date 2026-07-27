# DAT-036 authorized repair runbook

This procedure is intentionally dormant until production authority is granted.

## Preconditions

1. Name the target Atlas release and isolate the run from other country-fact
   writers.
2. Create a retained public correction-log record covering the date-precision
   transformation defect; record its UUID and approval.
3. Capture a fresh zero-write plan:

   ```sh
   npm run plan:wikidata-date-precision -- --write
   npm run validate:wikidata-date-precision
   ```

4. Confirm the checked plan still reports legacy rows as publisher-refresh
   bound. Do not infer precision from January 1 or the first day of a month.

## Authorized execution

Run the corrected Wikidata fact sync with the named release in the controlled
production/staging workflow. The sync must retrieve explicit Wikibase
`timePrecision` before writing. The owner/release operator must review the
dry-run value deltas separately so a publisher value revision is not silently
bundled into the precision correction.

The dedicated repair planner accepts `--apply` only for rows whose retained
snapshot already contains explicit precision, and additionally requires both
`--release-id` and `--correction-log-id`. The current legacy set contains zero
such rows; using `--apply` against the checked plan therefore performs no
repair. The full publisher refresh is required.

## Post-run verification

1. Re-run the live zero-write plan. Its legacy publisher-refresh count must be
   zero for the repaired current set.
2. Query the three DAT-034 rows and confirm:
   - Malaysia population has year precision and `as_of = NULL`.
   - Rwanda life expectancy has year precision and `as_of = NULL`.
   - Sweden population has month precision and `as_of = NULL`.
3. Confirm every changed fact has an append-only Atlas history event containing
   both `value_json` and `as_of` changes and the approved correction reference.
4. Run the release-quality, temporal-metadata, fact-coverage, API-doc,
   change-history, data-value-state, source-freshness, and DAT-036 gates.
5. Cut a new immutable vintage only after the repaired current rows pass.

## Rollback rule

Do not mutate the G2 release. If the refresh is invalid, contain the candidate
release, keep the prior current facts visible, preserve all history/evidence,
and correct forward under a new approved run.
