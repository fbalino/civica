CREATE TABLE "bill_summary_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cache_key" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"metric_id" text NOT NULL,
	"year" integer NOT NULL,
	"value" real NOT NULL,
	"rank" integer,
	"total_ranked" integer,
	"source_id" text NOT NULL,
	"source_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "election_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"election_id" uuid NOT NULL,
	"party_name" text,
	"party_color" text,
	"party_wikidata_qid" text,
	"candidate_name" text,
	"votes_count" integer,
	"votes_percent" real,
	"seats_won" integer,
	"is_winner" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"unit" text,
	"higher_is_better" boolean NOT NULL,
	"value_min" real,
	"value_max" real,
	"default_source_id" text
);
--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "election_name" text;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "electoral_system" text;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "registered_voters" integer;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "total_valid_votes" integer;--> statement-breakpoint
ALTER TABLE "elections" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "government_bodies" ADD COLUMN "parent_body_id" uuid;--> statement-breakpoint
ALTER TABLE "offices" ADD COLUMN "reports_to_office_id" uuid;--> statement-breakpoint
ALTER TABLE "country_metrics" ADD CONSTRAINT "country_metrics_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_metrics" ADD CONSTRAINT "country_metrics_metric_id_metric_definitions_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_metrics" ADD CONSTRAINT "country_metrics_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_results" ADD CONSTRAINT "election_results_election_id_elections_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."elections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_default_source_id_sources_id_fk" FOREIGN KEY ("default_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_summary_cache_key_idx" ON "bill_summary_cache" USING btree ("cache_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_country_metrics_unique" ON "country_metrics" USING btree ("jurisdiction_id","metric_id","year");--> statement-breakpoint
CREATE INDEX "idx_country_metrics_type_year" ON "country_metrics" USING btree ("metric_id","year");--> statement-breakpoint
CREATE INDEX "idx_country_metrics_jurisdiction" ON "country_metrics" USING btree ("jurisdiction_id");