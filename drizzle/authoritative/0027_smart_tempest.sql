CREATE TABLE "pulse_dimensional_delta_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text DEFAULT 'pulse-dimensional-delta-history/v1' NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"delta_value" real NOT NULL,
	"contributing_event_ids" uuid[] NOT NULL,
	"derivation_version_key" text NOT NULL,
	"derivation_versions" jsonb NOT NULL,
	"computation_run_id" uuid NOT NULL,
	"score_as_of" date NOT NULL,
	"window_start" date NOT NULL,
	"window_days" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_dimensional_delta_history_schema_check" CHECK ("pulse_dimensional_delta_history"."schema_version" = 'pulse-dimensional-delta-history/v1'),
	CONSTRAINT "pulse_dimensional_delta_history_dimension_check" CHECK ("pulse_dimensional_delta_history"."dimension" IN ('democratic_quality', 'rule_of_law', 'freedom_rights', 'corruption_control', 'stability')),
	CONSTRAINT "pulse_dimensional_delta_history_value_check" CHECK ("pulse_dimensional_delta_history"."delta_value" <> 'NaN'::real AND "pulse_dimensional_delta_history"."delta_value" >= -15 AND "pulse_dimensional_delta_history"."delta_value" <= 10),
	CONSTRAINT "pulse_dimensional_delta_history_window_check" CHECK ("pulse_dimensional_delta_history"."window_days" = 365 AND "pulse_dimensional_delta_history"."window_start" = "pulse_dimensional_delta_history"."score_as_of" - "pulse_dimensional_delta_history"."window_days")
);
--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "score_as_of" date;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "window_start" date;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "window_days" integer;--> statement-breakpoint
UPDATE "pulse_dimensional_deltas"
SET
	"score_as_of" = "last_computed_at"::date,
	"window_start" = "last_computed_at"::date - 365,
	"window_days" = 365;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "score_as_of" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "window_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "window_days" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_delta_history" ADD CONSTRAINT "pulse_dimensional_delta_history_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_delta_history" ADD CONSTRAINT "pulse_dimensional_delta_history_computation_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("computation_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_dim_history_run_jurisdiction_dimension" ON "pulse_dimensional_delta_history" USING btree ("computation_run_id","jurisdiction_id","dimension");--> statement-breakpoint
CREATE INDEX "idx_pulse_dim_history_jurisdiction_as_of" ON "pulse_dimensional_delta_history" USING btree ("jurisdiction_id","score_as_of");--> statement-breakpoint
CREATE INDEX "idx_pulse_dim_history_derivation_version" ON "pulse_dimensional_delta_history" USING btree ("derivation_version_key");--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD CONSTRAINT "pulse_dimensional_deltas_dimension_check" CHECK ("pulse_dimensional_deltas"."dimension" IN ('democratic_quality', 'rule_of_law', 'freedom_rights', 'corruption_control', 'stability'));--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD CONSTRAINT "pulse_dimensional_deltas_value_check" CHECK ("pulse_dimensional_deltas"."delta_value" <> 'NaN'::real AND "pulse_dimensional_deltas"."delta_value" >= -15 AND "pulse_dimensional_deltas"."delta_value" <= 10);--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD CONSTRAINT "pulse_dimensional_deltas_window_check" CHECK ("pulse_dimensional_deltas"."window_days" = 365 AND "pulse_dimensional_deltas"."window_start" = "pulse_dimensional_deltas"."score_as_of" - "pulse_dimensional_deltas"."window_days");--> statement-breakpoint
INSERT INTO "pulse_dimensional_delta_history" (
	"schema_version",
	"jurisdiction_id",
	"dimension",
	"delta_value",
	"contributing_event_ids",
	"derivation_version_key",
	"derivation_versions",
	"computation_run_id",
	"score_as_of",
	"window_start",
	"window_days",
	"created_at"
)
SELECT
	'pulse-dimensional-delta-history/v1',
	"jurisdiction_id",
	"dimension",
	"delta_value",
	"contributing_event_ids",
	"derivation_version_key",
	"derivation_versions",
	"computation_run_id",
	"score_as_of",
	"window_start",
	"window_days",
	"last_computed_at"
FROM "pulse_dimensional_deltas";--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_reject_pulse_dimensional_delta_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint
CREATE TRIGGER pulse_dimensional_delta_history_append_only
BEFORE UPDATE OR DELETE ON "pulse_dimensional_delta_history"
FOR EACH ROW
EXECUTE FUNCTION civica_reject_pulse_dimensional_delta_history_mutation();

-- civica-affected-relations: pulse_dimensional_deltas,pulse_dimensional_delta_history,research_evidence_history
