CREATE TABLE "production_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" text NOT NULL,
	"trigger_kind" text NOT NULL,
	"execution_key" text,
	"schedule_slot" timestamp with time zone,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"rows_read" integer,
	"rows_written" integer,
	"rows_rejected" integer,
	"source_versions" jsonb NOT NULL,
	"cost_microusd" integer,
	"error_summary" text,
	"freshness_source_ids" text[] NOT NULL,
	"metrics" jsonb NOT NULL,
	"release_id" text NOT NULL,
	"observability_version" text NOT NULL,
	CONSTRAINT "production_pipeline_run_identity_check" CHECK (length("production_pipeline_runs"."pipeline_id") BETWEEN 1 AND 100 AND "production_pipeline_runs"."pipeline_id" ~ '^[a-z][a-z0-9.-]*$' AND ("production_pipeline_runs"."execution_key" IS NULL OR "production_pipeline_runs"."execution_key" ~ '^[a-f0-9]{64}$') AND length("production_pipeline_runs"."release_id") BETWEEN 1 AND 96 AND "production_pipeline_runs"."release_id" ~ '^[A-Za-z0-9._-]+$' AND length("production_pipeline_runs"."observability_version") BETWEEN 1 AND 96 AND "production_pipeline_runs"."observability_version" ~ '^[A-Za-z0-9._/-]+$'),
	CONSTRAINT "production_pipeline_run_trigger_shape" CHECK (("production_pipeline_runs"."trigger_kind" = 'scheduled' AND "production_pipeline_runs"."execution_key" IS NOT NULL AND "production_pipeline_runs"."schedule_slot" IS NOT NULL) OR ("production_pipeline_runs"."trigger_kind" = 'manual' AND "production_pipeline_runs"."schedule_slot" IS NULL)),
	CONSTRAINT "production_pipeline_run_status_shape" CHECK (("production_pipeline_runs"."status" = 'running' AND "production_pipeline_runs"."completed_at" IS NULL AND "production_pipeline_runs"."error_summary" IS NULL) OR ("production_pipeline_runs"."status" IN ('succeeded','empty','anomalous') AND "production_pipeline_runs"."completed_at" IS NOT NULL AND "production_pipeline_runs"."error_summary" IS NULL) OR ("production_pipeline_runs"."status" = 'failed' AND "production_pipeline_runs"."completed_at" IS NOT NULL AND "production_pipeline_runs"."error_summary" IS NOT NULL)),
	CONSTRAINT "production_pipeline_run_counter_bounds" CHECK (("production_pipeline_runs"."rows_read" IS NULL OR "production_pipeline_runs"."rows_read" >= 0) AND ("production_pipeline_runs"."rows_written" IS NULL OR "production_pipeline_runs"."rows_written" >= 0) AND ("production_pipeline_runs"."rows_rejected" IS NULL OR "production_pipeline_runs"."rows_rejected" >= 0) AND ("production_pipeline_runs"."cost_microusd" IS NULL OR "production_pipeline_runs"."cost_microusd" >= 0)),
	CONSTRAINT "production_pipeline_run_payload_shape" CHECK (jsonb_typeof("production_pipeline_runs"."source_versions") = 'array' AND jsonb_typeof("production_pipeline_runs"."metrics") = 'object' AND cardinality("production_pipeline_runs"."freshness_source_ids") <= 64 AND ("production_pipeline_runs"."error_summary" IS NULL OR ("production_pipeline_runs"."error_summary" ~ '^[a-z][a-z0-9_.-]{0,79}$')))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_production_pipeline_execution" ON "production_pipeline_runs" USING btree ("execution_key") WHERE "production_pipeline_runs"."execution_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_production_pipeline_status_time" ON "production_pipeline_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "idx_production_pipeline_id_time" ON "production_pipeline_runs" USING btree ("pipeline_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_production_pipeline_schedule_slot" ON "production_pipeline_runs" USING btree ("pipeline_id","schedule_slot");