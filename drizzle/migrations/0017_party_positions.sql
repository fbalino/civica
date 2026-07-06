-- Party ideology positions — one row per matched Civica party, carrying the
-- V-Dem V-Party v2 compass position (economic left–right × anti-pluralism).
-- Contract: plan/party-ideology-sourcing-resolution-v1.md §4.
--
-- Keyed 1:1 to a `legislature_parties` row (unique on `legislature_party_id`)
-- so ideology attaches to a specific Civica party and travels with it. A
-- separate table (not new columns on `legislature_parties`) keeps the frozen
-- 2022 V-Party vintage from entangling with the live seat-snapshot cadence and
-- lets a future V-Party vintage swap in without touching seat data. A party
-- with no V-Party match gets NO row here — the UI renders an honest "ideology
-- not recorded" state, never a fabricated position (resolution §5).
--
-- Two stored axis values (resolution §2.5):
--   economic_left_right = v2pariglef  (interval point estimate, X axis)
--   anti_pluralism      = v2xpa_antiplural (Anti-Pluralism Index 0–1, Y axis)
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than drizzle-kit-generated,
-- matching 0013_electoral_systems.sql / 0016_indicator_history.sql: the repo's
-- drizzle snapshot baseline is out of sync with the live DB (a pre-existing
-- Phase F state issue, not in this change's scope). Applied to the live DB via
-- `drizzle-kit push`; this file records the change idempotently so the migration
-- history stays complete.

CREATE TABLE IF NOT EXISTS "party_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legislature_party_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"vparty_id" integer NOT NULL,
	"vparty_name_en" text,
	"economic_left_right" real NOT NULL,
	"economic_lr_ord" integer,
	"anti_pluralism" real NOT NULL,
	"populism" real,
	"coded_year" integer NOT NULL,
	"match_method" text NOT NULL,
	"match_confidence" text DEFAULT 'high' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Idempotent add for pre-existing party_positions tables (created before the
-- confidence gate landed). 'high' default keeps existing exact/abbrev rows
-- displayable; the ingest re-stamps fuzzy 'token' rows to 'review' on --apply.
-- Resolution §4.2: only 'high' rows surface a displayable position.
DO $$ BEGIN
	ALTER TABLE "party_positions"
		ADD COLUMN "match_confidence" text DEFAULT 'high' NOT NULL;
EXCEPTION
	WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "party_positions"
		ADD CONSTRAINT "party_positions_legislature_party_id_legislature_parties_id_fk"
		FOREIGN KEY ("legislature_party_id") REFERENCES "legislature_parties"("id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "party_positions"
		ADD CONSTRAINT "party_positions_source_id_sources_id_fk"
		FOREIGN KEY ("source_id") REFERENCES "sources"("id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

-- One ideology position per Civica party row — the upsert conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_party_positions_legislature_party"
	ON "party_positions" ("legislature_party_id");

CREATE INDEX IF NOT EXISTS "idx_party_positions_source"
	ON "party_positions" ("source_id");
