CREATE TABLE "pulse_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"event_date" timestamp NOT NULL,
	"category" text DEFAULT 'unclassified' NOT NULL,
	"severity" real DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"justification" text DEFAULT '' NOT NULL,
	"headline" text NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text NOT NULL,
	"llm_model" text DEFAULT '' NOT NULL,
	"raw_event_data" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pulse_events" ADD CONSTRAINT "pulse_events_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_events_url_jurisdiction" ON "pulse_events" USING btree ("source_url","jurisdiction_id");
--> statement-breakpoint
CREATE INDEX "idx_pulse_events_jurisdiction" ON "pulse_events" USING btree ("jurisdiction_id");
--> statement-breakpoint
CREATE INDEX "idx_pulse_events_event_date" ON "pulse_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX "idx_pulse_events_category" ON "pulse_events" USING btree ("category");
