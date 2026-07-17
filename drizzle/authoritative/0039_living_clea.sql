CREATE TABLE "error_monitoring_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"surface" text NOT NULL,
	"route_id" text,
	"job_id" text,
	"error_code" text NOT NULL,
	"release_id" text NOT NULL,
	"source_map_id" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"monitoring_version" text NOT NULL,
	CONSTRAINT "error_monitoring_identity_check" CHECK (length("error_monitoring_events"."fingerprint") = 64 AND "error_monitoring_events"."fingerprint" ~ '^[a-f0-9]{64}$' AND "error_monitoring_events"."surface" IN ('server','client','cron','script') AND "error_monitoring_events"."error_code" ~ '^[a-z][a-z0-9_.-]{0,79}$' AND "error_monitoring_events"."release_id" ~ '^[A-Za-z0-9._-]{1,96}$' AND "error_monitoring_events"."source_map_id" ~ '^nextjs-protected/[A-Za-z0-9._-]{1,96}$' AND length("error_monitoring_events"."monitoring_version") BETWEEN 1 AND 96 AND "error_monitoring_events"."monitoring_version" ~ '^[A-Za-z0-9._/-]+$' AND "error_monitoring_events"."occurrence_count" >= 1),
	CONSTRAINT "error_monitoring_context_check" CHECK ((("error_monitoring_events"."surface" IN ('server','client') AND "error_monitoring_events"."route_id" ~ '^[a-z][a-z0-9._-]{0,159}$' AND "error_monitoring_events"."job_id" IS NULL) OR ("error_monitoring_events"."surface" = 'cron' AND "error_monitoring_events"."route_id" ~ '^[a-z][a-z0-9._-]{0,159}$' AND "error_monitoring_events"."job_id" ~ '^[a-z][a-z0-9.-]{0,79}$') OR ("error_monitoring_events"."surface" = 'script' AND "error_monitoring_events"."route_id" IS NULL AND "error_monitoring_events"."job_id" ~ '^[a-z][a-z0-9.-]{0,79}$'))),
	CONSTRAINT "error_monitoring_resolution_shape" CHECK (("error_monitoring_events"."status" = 'open' AND "error_monitoring_events"."resolved_at" IS NULL) OR ("error_monitoring_events"."status" = 'resolved' AND "error_monitoring_events"."resolved_at" IS NOT NULL AND "error_monitoring_events"."resolved_at" >= "error_monitoring_events"."first_seen_at"))
);
--> statement-breakpoint
CREATE TABLE "error_monitoring_issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_monitoring_issue_link_shape" CHECK ("error_monitoring_issue_links"."record_type" IN ('correction','status') AND "error_monitoring_issue_links"."record_id" ~ '^[A-Za-z0-9._:-]{1,160}$')
);
--> statement-breakpoint
ALTER TABLE "error_monitoring_issue_links" ADD CONSTRAINT "error_monitoring_issue_links_event_id_error_monitoring_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."error_monitoring_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_error_monitoring_fingerprint" ON "error_monitoring_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_error_monitoring_open_last_seen" ON "error_monitoring_events" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "idx_error_monitoring_release_last_seen" ON "error_monitoring_events" USING btree ("release_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_error_monitoring_issue_link_unique" ON "error_monitoring_issue_links" USING btree ("event_id","record_type","record_id");--> statement-breakpoint
CREATE INDEX "idx_error_monitoring_issue_link_event" ON "error_monitoring_issue_links" USING btree ("event_id");