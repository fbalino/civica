-- CIA-stale-vintage correction — Option A (owner-confirmed).
-- Resolution: ~/civica/plan/cia-stale-vintage-resolution-v1.md (§5 Option A, §6)
--
-- Adds the nullable `data_vintage_year` column to country_facts. This
-- records the REAL underlying measurement year for a row when it differs
-- from the publisher's prose-vintage stamp (`fact_year` / `as_of`),
-- WITHOUT mutating that original stamp.
--
-- The resolver's freshness comparator uses `data_vintage_year` when it is
-- non-null, else falls back to the existing `as_of || fact_year ||
-- retrieved_at` ladder. The column stays NULL for every row whose stamp
-- already equals its measurement year (the common case) — no false
-- precision. It is populated ONLY for the five CIA demographic fact-keys
-- whose projection methodology is documented (see
-- scripts/backfill-cia-vintage.ts and scripts/seed-from-factbook.ts).
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than
-- drizzle-kit-generated, matching 0012_bug1_value_type.sql /
-- 0016_indicator_history.sql: the repo's drizzle snapshot baseline is out
-- of sync with the live DB (a pre-existing Phase F state issue, not in
-- this change's scope). Applied to the live DB via `drizzle-kit push`;
-- this file records the change idempotently so the migration history
-- stays complete. The column-add is safe to re-run.

ALTER TABLE "country_facts"
  ADD COLUMN IF NOT EXISTS "data_vintage_year" integer;
