CREATE TABLE "ci_research_panel_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" text NOT NULL,
	"status" text DEFAULT 'staging' NOT NULL,
	"period_start" integer NOT NULL,
	"period_end" integer NOT NULL,
	"jurisdiction_count" integer NOT NULL,
	"indicator_count" integer NOT NULL,
	"expected_rows" integer NOT NULL,
	"observed_rows" integer NOT NULL,
	"missing_rows" integer NOT NULL,
	"row_sha256" text NOT NULL,
	"coverage_sha256" text NOT NULL,
	"temporal_breaks_sha256" text NOT NULL,
	"generator_version" text NOT NULL,
	"source_snapshot" jsonb NOT NULL,
	"rights_posture" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "ci_research_panel_release_status" CHECK ("ci_research_panel_releases"."status" IN ('staging','complete')),
	CONSTRAINT "ci_research_panel_release_period" CHECK ("ci_research_panel_releases"."period_start" <= "ci_research_panel_releases"."period_end"),
	CONSTRAINT "ci_research_panel_release_counts" CHECK ("ci_research_panel_releases"."expected_rows" = "ci_research_panel_releases"."observed_rows" + "ci_research_panel_releases"."missing_rows" AND "ci_research_panel_releases"."expected_rows" = "ci_research_panel_releases"."jurisdiction_count" * "ci_research_panel_releases"."indicator_count" * ("ci_research_panel_releases"."period_end" - "ci_research_panel_releases"."period_start" + 1)),
	CONSTRAINT "ci_research_panel_release_hashes" CHECK ("ci_research_panel_releases"."row_sha256" ~ '^[a-f0-9]{64}$' AND "ci_research_panel_releases"."coverage_sha256" ~ '^[a-f0-9]{64}$' AND "ci_research_panel_releases"."temporal_breaks_sha256" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "ci_research_panel_rows" (
	"release_id" text NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"period_year" integer NOT NULL,
	"dimension" text NOT NULL,
	"indicator_id" text NOT NULL,
	"source_id" text NOT NULL,
	"source_owner" text NOT NULL,
	"retrieval_path" text NOT NULL,
	"value" real,
	"value_status" text NOT NULL,
	"missing_reason" text,
	"native_unit" text NOT NULL,
	"native_min" real NOT NULL,
	"native_max" real NOT NULL,
	"is_inverted" boolean NOT NULL,
	"transform_id" text NOT NULL,
	"source_vintage" text NOT NULL,
	"source_vintage_status" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"uncertainty_status" text NOT NULL,
	"uncertainty_lower" real,
	"uncertainty_upper" real,
	"revision_status" text NOT NULL,
	"series_type" text NOT NULL,
	"content_hash" text NOT NULL,
	CONSTRAINT "ci_research_panel_rows_release_id_jurisdiction_id_indicator_id_source_id_period_year_pk" PRIMARY KEY("release_id","jurisdiction_id","indicator_id","source_id","period_year"),
	CONSTRAINT "ci_research_panel_value_state" CHECK (("ci_research_panel_rows"."value_status" = 'observed' AND "ci_research_panel_rows"."value" IS NOT NULL AND "ci_research_panel_rows"."missing_reason" IS NULL) OR ("ci_research_panel_rows"."value_status" = 'missing' AND "ci_research_panel_rows"."value" IS NULL AND "ci_research_panel_rows"."missing_reason" IS NOT NULL)),
	CONSTRAINT "ci_research_panel_uncertainty_shape" CHECK (("ci_research_panel_rows"."uncertainty_lower" IS NULL AND "ci_research_panel_rows"."uncertainty_upper" IS NULL) OR ("ci_research_panel_rows"."uncertainty_lower" IS NOT NULL AND "ci_research_panel_rows"."uncertainty_upper" IS NOT NULL AND "ci_research_panel_rows"."uncertainty_lower" <= "ci_research_panel_rows"."uncertainty_upper")),
	CONSTRAINT "ci_research_panel_content_hash" CHECK ("ci_research_panel_rows"."content_hash" ~ '^[a-f0-9]{64}$' AND "ci_research_panel_rows"."artifact_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ci_research_panel_rows" ADD CONSTRAINT "ci_research_panel_rows_release_id_ci_research_panel_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."ci_research_panel_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_research_panel_rows" ADD CONSTRAINT "ci_research_panel_rows_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_research_panel_rows" ADD CONSTRAINT "ci_research_panel_rows_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ci_research_panel_release_year" ON "ci_research_panel_rows" USING btree ("release_id","period_year");--> statement-breakpoint
CREATE INDEX "idx_ci_research_panel_release_indicator" ON "ci_research_panel_rows" USING btree ("release_id","indicator_id");