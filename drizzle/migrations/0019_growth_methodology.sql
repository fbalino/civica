-- GDP growth-methodology labeling — Option E (owner-adopted).
-- Resolution: ~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md
--
-- Different publishers report GDP growth on different measurement bases
-- (annual year-on-year, four-quarter accumulated, quarter-on-quarter
-- seasonally adjusted, annualized quarterly). The raw numbers are NOT
-- directly comparable across bases. This column labels each source row
-- on `gdp_real_growth_rate` (and its `gdp_growth_rate` legacy alias) with
-- the measurement style so the resolver can prefer the comparable
-- annual-YoY publisher, and the UI can disclose the basis via an InfoTip.
--
-- Controlled vocabulary (src/lib/data/growth-methodology.ts):
--   annual_yoy | four_quarter_accumulated_yoy | qoq_seasonally_adjusted
--   | annualized_qoq | unspecified
--
-- NULL for every non-growth fact-key (the column is meaningful only on
-- the growth fact-keys). Populated by scripts/backfill-growth-methodology.ts
-- and set at write time by each growth-emitting sync script.
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than
-- drizzle-kit-generated, matching 0012_bug1_value_type.sql /
-- 0016_indicator_history.sql / 0018_data_vintage_year.sql: the repo's
-- drizzle snapshot baseline is out of sync with the live DB (a pre-existing
-- Phase F state issue, not in this change's scope). Applied to the live DB
-- via `drizzle-kit push`; this file records the change idempotently so the
-- migration history stays complete. The column-add is safe to re-run.

ALTER TABLE "country_facts"
  ADD COLUMN IF NOT EXISTS "growth_methodology" text;
