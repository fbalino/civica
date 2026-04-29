CREATE TABLE "pulse_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"event_id" uuid,
	"country_id" uuid,
	"category" text NOT NULL,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_affiliation" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"disposition" text,
	"resolved_at" timestamp,
	"is_public" boolean DEFAULT true NOT NULL,
	"internal_notes" text
);
--> statement-breakpoint
CREATE TABLE "pulse_dimensional_deltas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"delta_value" real NOT NULL,
	"contributing_event_ids" uuid[] NOT NULL,
	"last_computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_events_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"event_date" date NOT NULL,
	"category" text NOT NULL,
	"dimension" text NOT NULL,
	"severity_tier" text NOT NULL,
	"severity_value" real NOT NULL,
	"corroboration_confidence" real NOT NULL,
	"classifier_runs" jsonb NOT NULL,
	"classifier_agreement" text NOT NULL,
	"human_reviewed" boolean DEFAULT false NOT NULL,
	"reviewer_id" text,
	"review_notes" text,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"headline" text NOT NULL,
	"description" text NOT NULL,
	"press_freedom_score_at_classification" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pulse_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text,
	"raw_event_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "raw_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text,
	"source_url" text,
	"source_type" text NOT NULL,
	"jurisdiction_id" uuid,
	"raw_country_name" text,
	"event_date" date,
	"retrieved_at" timestamp DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"raw" jsonb NOT NULL,
	"embedding" real[],
	"cluster_id" uuid,
	"clustered_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pulse_corrections" ADD CONSTRAINT "pulse_corrections_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_corrections" ADD CONSTRAINT "pulse_corrections_country_id_jurisdictions_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD CONSTRAINT "pulse_dimensional_deltas_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_sources" ADD CONSTRAINT "pulse_sources_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_sources" ADD CONSTRAINT "pulse_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_sources" ADD CONSTRAINT "pulse_sources_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_dim_unique" ON "pulse_dimensional_deltas" USING btree ("jurisdiction_id","dimension");--> statement-breakpoint
CREATE INDEX "idx_pulse_dim_jurisdiction" ON "pulse_dimensional_deltas" USING btree ("jurisdiction_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_jurisdiction_date" ON "pulse_events_v2" USING btree ("jurisdiction_id","event_date");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_published" ON "pulse_events_v2" USING btree ("published","review_status");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_dimension" ON "pulse_events_v2" USING btree ("dimension","event_date");--> statement-breakpoint
CREATE INDEX "idx_pulse_sources_event" ON "pulse_sources" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_sources_source" ON "pulse_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_raw_events_jurisdiction_date" ON "raw_events" USING btree ("jurisdiction_id","event_date");--> statement-breakpoint
CREATE INDEX "idx_raw_events_unclustered" ON "raw_events" USING btree ("clustered_at");--> statement-breakpoint
CREATE INDEX "idx_raw_events_cluster" ON "raw_events" USING btree ("cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_raw_events_external" ON "raw_events" USING btree ("source_id","external_id") WHERE "raw_events"."external_id" IS NOT NULL;