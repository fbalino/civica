# ATL-007 migration plan

ATL-007 is a read-contract and writer-identity change. It requires no schema
migration and does not rewrite the 915 stored baseline rows.

1. Generate the checked audit artifact from a read-only live query and fail if
   the row count or fingerprint changes.
2. Verify each publisher jurisdiction assignment from Wikidata P17 plus any
   explicit P1001 scope, or from IPU election/chamber country codes. Quarantine
   missing evidence and any explicit scope that conflicts with the assigned
   national jurisdiction.
3. Admit only qualified events, qualified chamber contests, or explicitly
   labelled projections to public readers.
4. Fail turnout and result fields closed unless each field has eligible
   statement evidence.
5. Keep tentative source dates separate from term-derived projections; neither
   is presented as an independently verified schedule.
6. Consolidate unlabeled calendar projections by jurisdiction and election
   type; retain named chamber rows on detailed surfaces.
7. Include `body_id` in fallback writer identity so valid same-day chamber
   contests do not overwrite one another.
8. Audit every previously qualified Wikidata row carrying P1001, not only the
   triggering record, and retain the conflicting scope IDs in checked evidence.
9. Roll back by reverting the ATL-007 commit. No stored row needs compensation;
   the checked artifact and query guards disappear together.
