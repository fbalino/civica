-- Bug 1 — Forecast vs. measurement canonical pick
-- Resolution: ~/civica/plan/forecast-vs-measurement-v1.md (ADOPTED 2026-05-04)
--
-- Adds the `value_type` column to country_facts, the supporting index,
-- and backfills the IMF WEO forecast rows (year > current calendar year)
-- to value_type='projected'. Everything else inherits the column default
-- 'measured', which is the correct value for every non-IMF source today
-- (CIA, WB, UN, Wikidata, V-Dem, WHO) and for IMF terminal-year rows
-- (Syria 2010, Eritrea 2019, etc. — IMF's series ended at those years
-- because of state collapse / sanctions; they ARE measurements at IMF's
-- terminal vintage for those countries).
--
-- This file is hand-authored rather than drizzle-kit-generated because
-- the repo's drizzle snapshot baseline is out of sync with the live
-- DB schema (a pre-existing Phase F state issue not in Bug-1 scope).
-- The column-add + index-add are idempotent (`IF NOT EXISTS`), and
-- the backfill UPDATE is similarly safe to re-run.

ALTER TABLE "country_facts"
  ADD COLUMN IF NOT EXISTS "value_type" text NOT NULL DEFAULT 'measured';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_country_facts_factkey_valuetype"
  ON "country_facts" USING btree ("fact_key","value_type");
--> statement-breakpoint

-- Bug-1 backfill: tag IMF WEO forecast-year rows as 'projected'.
-- Year-based discriminator: a row whose fact_year is greater than the
-- current calendar year is a forecast. Past-year IMF rows (terminal
-- year for closed-data countries) stay 'measured' because they are
-- measurements at IMF's terminal vintage.
UPDATE "country_facts"
   SET "value_type" = 'projected'
 WHERE "source_id" = 'imf_weo'
   AND "fact_year" IS NOT NULL
   AND "fact_year" > EXTRACT(YEAR FROM CURRENT_DATE)::int;
