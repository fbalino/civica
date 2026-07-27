CREATE TABLE "pulse_drift_baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"baseline_key" text NOT NULL,
	"runtime_method_version" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_drift_baselines_baseline_key_unique" UNIQUE("baseline_key"),
	CONSTRAINT "pulse_drift_baselines_contract_check" CHECK ("pulse_drift_baselines"."schema_version" = 'pulse-drift-baseline/v1' AND "pulse_drift_baselines"."baseline_key" ~ '^pulse-drift-baseline/sha256:[a-f0-9]{64}$' AND btrim("pulse_drift_baselines"."runtime_method_version") <> '' AND "pulse_drift_baselines"."window_end" > "pulse_drift_baselines"."window_start" AND jsonb_typeof("pulse_drift_baselines"."snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "pulse_drift_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"observation_key" text NOT NULL,
	"score_run_id" uuid NOT NULL,
	"baseline_id" uuid,
	"runtime_method_version" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"snapshot" jsonb NOT NULL,
	"standing" text NOT NULL,
	"alert_count" integer NOT NULL,
	"observed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_drift_observations_observation_key_unique" UNIQUE("observation_key"),
	CONSTRAINT "pulse_drift_observations_score_run_id_unique" UNIQUE("score_run_id"),
	CONSTRAINT "pulse_drift_observations_contract_check" CHECK ("pulse_drift_observations"."schema_version" = 'pulse-drift-observation/v1' AND "pulse_drift_observations"."observation_key" ~ '^pulse-drift-observation/sha256:[a-f0-9]{64}$' AND btrim("pulse_drift_observations"."runtime_method_version") <> '' AND "pulse_drift_observations"."window_end" > "pulse_drift_observations"."window_start" AND jsonb_typeof("pulse_drift_observations"."snapshot") = 'object' AND "pulse_drift_observations"."standing" IN ('no_baseline','insufficient_evidence','within_threshold','alerts_open') AND "pulse_drift_observations"."alert_count" >= 0 AND (("pulse_drift_observations"."standing" = 'no_baseline' AND "pulse_drift_observations"."baseline_id" IS NULL AND "pulse_drift_observations"."alert_count" = 0) OR ("pulse_drift_observations"."standing" = 'insufficient_evidence' AND "pulse_drift_observations"."baseline_id" IS NOT NULL AND "pulse_drift_observations"."alert_count" = 0) OR ("pulse_drift_observations"."standing" = 'within_threshold' AND "pulse_drift_observations"."baseline_id" IS NOT NULL AND "pulse_drift_observations"."alert_count" = 0) OR ("pulse_drift_observations"."standing" = 'alerts_open' AND "pulse_drift_observations"."baseline_id" IS NOT NULL AND "pulse_drift_observations"."alert_count" > 0)))
);
--> statement-breakpoint
CREATE TABLE "pulse_drift_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"alert_key" text NOT NULL,
	"observation_id" uuid NOT NULL,
	"baseline_id" uuid NOT NULL,
	"metric" text NOT NULL,
	"reason" text NOT NULL,
	"comparison" jsonb NOT NULL,
	"affected_row_refs" jsonb NOT NULL,
	"remediation_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_drift_alerts_alert_key_unique" UNIQUE("alert_key"),
	CONSTRAINT "pulse_drift_alerts_contract_check" CHECK ("pulse_drift_alerts"."schema_version" = 'pulse-drift-alert/v1' AND "pulse_drift_alerts"."alert_key" ~ '^pulse-drift-alert/sha256:[a-f0-9]{64}$' AND "pulse_drift_alerts"."metric" IN ('source_mix','language_mix','model_versions','taxonomy_labels','corroboration_weight','abstention','review_overturns') AND "pulse_drift_alerts"."reason" IN ('distribution_shift','novel_model_version') AND jsonb_typeof("pulse_drift_alerts"."comparison") = 'object' AND jsonb_typeof("pulse_drift_alerts"."affected_row_refs") = 'array' AND jsonb_array_length("pulse_drift_alerts"."affected_row_refs") > 0 AND btrim("pulse_drift_alerts"."remediation_path") <> '')
);
--> statement-breakpoint
ALTER TABLE "pulse_drift_observations" ADD CONSTRAINT "pulse_drift_observations_score_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("score_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pulse_drift_observations" ADD CONSTRAINT "pulse_drift_observations_baseline_id_pulse_drift_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."pulse_drift_baselines"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pulse_drift_alerts" ADD CONSTRAINT "pulse_drift_alerts_observation_id_pulse_drift_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."pulse_drift_observations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "pulse_drift_alerts" ADD CONSTRAINT "pulse_drift_alerts_baseline_id_pulse_drift_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."pulse_drift_baselines"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_pulse_drift_baseline_method_created" ON "pulse_drift_baselines" USING btree ("runtime_method_version","created_at");
--> statement-breakpoint
CREATE INDEX "idx_pulse_drift_observation_method_time" ON "pulse_drift_observations" USING btree ("runtime_method_version","observed_at");
--> statement-breakpoint
CREATE INDEX "idx_pulse_drift_alert_observation" ON "pulse_drift_alerts" USING btree ("observation_id");
--> statement-breakpoint
CREATE INDEX "idx_pulse_drift_alert_metric_created" ON "pulse_drift_alerts" USING btree ("metric","created_at");
--> statement-breakpoint
CREATE TRIGGER pulse_drift_baselines_append_only BEFORE UPDATE OR DELETE ON "pulse_drift_baselines" FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();
--> statement-breakpoint
CREATE TRIGGER pulse_drift_observations_append_only BEFORE UPDATE OR DELETE ON "pulse_drift_observations" FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();
--> statement-breakpoint
CREATE TRIGGER pulse_drift_alerts_append_only BEFORE UPDATE OR DELETE ON "pulse_drift_alerts" FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();

-- civica-affected-relations: pulse_drift_baselines,pulse_drift_observations,pulse_drift_alerts
