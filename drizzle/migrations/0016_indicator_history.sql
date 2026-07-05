-- Long-run source-indicator history — one row per (jurisdiction, indicator,
-- year). Backs the multi-series historical trend charts on the country page's
-- Civica Data tab (audit Recommendation 4: "trend evidence is what governance
-- scholars actually cite").
--
-- The CI pipeline (`ci_dimension_scores`) intentionally keeps only the latest
-- vintage per quarter. This table is the parallel, append-only archive of the
-- FULL published series for each of the six CI source indicators — V-Dem back
-- to 1789, Freedom House 2003+, WGI 1996+, HDI 1990+, CPI 2012+. It is read-only
-- evidence for the chart; it does NOT feed CI scoring.
--
-- Values are stored in each source's NATIVE published scale (with the scale
-- bounds + orientation captured per row), not pre-normalised to 0–100, so the
-- archive stays faithful to the citable source and the chart owns display
-- normalisation.
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than drizzle-kit-generated,
-- matching 0012_bug1_value_type.sql / 0013_electoral_systems.sql /
-- 0014_advisory_applications.sql: the repo's drizzle snapshot baseline is out of
-- sync with the live DB (a pre-existing Phase F state issue, not in this change's
-- scope). Applied to the live DB via `drizzle-kit push`; this file records the
-- change idempotently so the migration history stays complete.

CREATE TABLE IF NOT EXISTS "indicator_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"indicator" text NOT NULL,
	"year" integer NOT NULL,
	"value" real NOT NULL,
	"native_min" real NOT NULL,
	"native_max" real NOT NULL,
	"is_inverted" boolean DEFAULT false NOT NULL,
	"source_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
	ALTER TABLE "indicator_history"
		ADD CONSTRAINT "indicator_history_jurisdiction_id_jurisdictions_id_fk"
		FOREIGN KEY ("jurisdiction_id") REFERENCES "jurisdictions"("id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "indicator_history"
		ADD CONSTRAINT "indicator_history_source_id_sources_id_fk"
		FOREIGN KEY ("source_id") REFERENCES "sources"("id");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

-- Uniqueness: one observation per country + indicator + year. This is the
-- upsert conflict target for the idempotent backfill.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_indicator_history_unique"
	ON "indicator_history" ("jurisdiction_id", "indicator", "year");

-- Hot path: "every year of every indicator for this country".
CREATE INDEX IF NOT EXISTS "idx_indicator_history_jur_dim"
	ON "indicator_history" ("jurisdiction_id", "dimension");

CREATE INDEX IF NOT EXISTS "idx_indicator_history_indicator"
	ON "indicator_history" ("indicator");
