CREATE TABLE "pulse_classification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"attempt_key" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	"incident_id" uuid,
	"config_hash" text NOT NULL,
	"ordinal" integer NOT NULL,
	"run_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"model_call_count" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"next_retry_at" timestamp,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_classification_attempt_contract_check" CHECK ("pulse_classification_attempts"."schema_version" = 'pulse-classification-attempt/v1' AND "pulse_classification_attempts"."attempt_key" ~ '^pulse-classification-attempt/sha256:[a-f0-9]{64}$' AND "pulse_classification_attempts"."config_hash" ~ '^pulse-classification-config/v1/sha256:[a-f0-9]{64}$' AND "pulse_classification_attempts"."ordinal" BETWEEN 1 AND 10 AND "pulse_classification_attempts"."outcome" IN ('started','classified','none','retryable_failure','terminal_failure') AND "pulse_classification_attempts"."model_call_count" >= 0 AND jsonb_typeof("pulse_classification_attempts"."metadata") = 'object' AND (("pulse_classification_attempts"."outcome" = 'started' AND "pulse_classification_attempts"."completed_at" IS NULL AND "pulse_classification_attempts"."error_code" IS NULL AND "pulse_classification_attempts"."error_message" IS NULL) OR ("pulse_classification_attempts"."outcome" IN ('classified','none') AND "pulse_classification_attempts"."completed_at" IS NOT NULL AND "pulse_classification_attempts"."next_retry_at" IS NULL AND "pulse_classification_attempts"."error_code" IS NULL AND "pulse_classification_attempts"."error_message" IS NULL) OR ("pulse_classification_attempts"."outcome" = 'retryable_failure' AND "pulse_classification_attempts"."completed_at" IS NOT NULL AND "pulse_classification_attempts"."next_retry_at" IS NOT NULL AND "pulse_classification_attempts"."error_code" IS NOT NULL AND "pulse_classification_attempts"."error_message" IS NOT NULL) OR ("pulse_classification_attempts"."outcome" = 'terminal_failure' AND "pulse_classification_attempts"."completed_at" IS NOT NULL AND "pulse_classification_attempts"."next_retry_at" IS NULL AND "pulse_classification_attempts"."error_code" IS NOT NULL AND "pulse_classification_attempts"."error_message" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "pulse_cluster_classification_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"cluster_id" uuid NOT NULL,
	"incident_id" uuid,
	"config_hash" text NOT NULL,
	"config" jsonb NOT NULL,
	"status" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"first_attempt_at" timestamp NOT NULL,
	"last_attempt_at" timestamp NOT NULL,
	"next_retry_at" timestamp,
	"terminal_at" timestamp,
	"lease_expires_at" timestamp,
	"last_error_code" text,
	"last_error_message" text,
	"last_run_id" uuid NOT NULL,
	"event_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_classification_state_contract_check" CHECK ("pulse_cluster_classification_states"."schema_version" = 'pulse-classification-state/v1' AND "pulse_cluster_classification_states"."config_hash" ~ '^pulse-classification-config/v1/sha256:[a-f0-9]{64}$' AND jsonb_typeof("pulse_cluster_classification_states"."config") = 'object' AND "pulse_cluster_classification_states"."status" IN ('classified','none','retryable_failure','terminal_failure') AND "pulse_cluster_classification_states"."attempt_count" BETWEEN 1 AND "pulse_cluster_classification_states"."max_attempts" AND "pulse_cluster_classification_states"."max_attempts" BETWEEN 1 AND 10 AND "pulse_cluster_classification_states"."last_attempt_at" >= "pulse_cluster_classification_states"."first_attempt_at" AND (("pulse_cluster_classification_states"."status" = 'retryable_failure' AND "pulse_cluster_classification_states"."next_retry_at" IS NOT NULL AND "pulse_cluster_classification_states"."terminal_at" IS NULL AND "pulse_cluster_classification_states"."event_id" IS NULL AND "pulse_cluster_classification_states"."last_error_code" IS NOT NULL AND "pulse_cluster_classification_states"."last_error_message" IS NOT NULL) OR ("pulse_cluster_classification_states"."status" = 'terminal_failure' AND "pulse_cluster_classification_states"."next_retry_at" IS NULL AND "pulse_cluster_classification_states"."terminal_at" IS NOT NULL AND "pulse_cluster_classification_states"."event_id" IS NULL AND "pulse_cluster_classification_states"."last_error_code" IS NOT NULL AND "pulse_cluster_classification_states"."last_error_message" IS NOT NULL) OR ("pulse_cluster_classification_states"."status" = 'none' AND "pulse_cluster_classification_states"."next_retry_at" IS NULL AND "pulse_cluster_classification_states"."terminal_at" IS NOT NULL AND "pulse_cluster_classification_states"."event_id" IS NULL AND "pulse_cluster_classification_states"."last_error_code" IS NULL AND "pulse_cluster_classification_states"."last_error_message" IS NULL) OR ("pulse_cluster_classification_states"."status" = 'classified' AND "pulse_cluster_classification_states"."next_retry_at" IS NULL AND "pulse_cluster_classification_states"."terminal_at" IS NOT NULL AND "pulse_cluster_classification_states"."event_id" IS NOT NULL AND "pulse_cluster_classification_states"."last_error_code" IS NULL AND "pulse_cluster_classification_states"."last_error_message" IS NULL)))
);
--> statement-breakpoint
ALTER TABLE "pulse_classification_attempts" ADD CONSTRAINT "pulse_classification_attempts_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_classification_attempts" ADD CONSTRAINT "pulse_classification_attempts_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_cluster_classification_states" ADD CONSTRAINT "pulse_cluster_classification_states_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_cluster_classification_states" ADD CONSTRAINT "pulse_cluster_classification_states_last_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_cluster_classification_states" ADD CONSTRAINT "pulse_cluster_classification_states_event_id_pulse_events_v2_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pulse_events_v2"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_classification_attempt_key" ON "pulse_classification_attempts" USING btree ("attempt_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_classification_attempt_phase" ON "pulse_classification_attempts" USING btree ("cluster_id","config_hash","ordinal","outcome");--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_attempt_run" ON "pulse_classification_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_attempt_cluster" ON "pulse_classification_attempts" USING btree ("cluster_id","config_hash","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_classification_state_cluster_config" ON "pulse_cluster_classification_states" USING btree ("cluster_id","config_hash");--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_state_queue" ON "pulse_cluster_classification_states" USING btree ("config_hash","status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_state_incident" ON "pulse_cluster_classification_states" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_classification_state_run" ON "pulse_cluster_classification_states" USING btree ("last_run_id");--> statement-breakpoint

-- PUL-032 historical boundary. The active configuration is known now, but
-- historic model-call counts and per-provider failures were not retained.
-- Backfill only terminal outcomes proved directly by existing event/raw rows.
WITH config AS (
  SELECT
    'pulse-classification-config/v1/sha256:cfc659092a62368cfa317933d9ed38439a1a9857fddaa21481520c5199b8644e'::text AS config_hash,
    '{"methodVersion":"pulse-v2.10-beta","ontologyVersion":"v2.0","algorithmVersion":"pulse-classification/ensemble-verify-subject-v2.1","classifierPromptVersion":"pulse-classifier-prompt/sha256:a5e4f860a48d61bc","publicationGateVersion":"pulse-publication-gate/ensemble-review-v2","classifyEngines":[{"provider":"deepseek","model":"deepseek-v4-flash"},{"provider":"glm","model":"glm-4.7"},{"provider":"anthropic","model":"claude-haiku-4-5"}],"verifyEngine":{"provider":"anthropic","model":"claude-haiku-4-5"},"subjectAttribution":{"provider":"anthropic","model":"claude-sonnet-4-6","attributionVersion":"pulse-jurisdiction-attribution/v2","promptVersion":"pulse-subject-attribution-prompt/sha256:d80d9f54b70860a6"},"decodeMode":"temperature-0-json","thinkingMode":"disabled","retryPolicy":{"maxAttempts":3,"initialDelayMs":900000,"multiplier":4,"maxDelayMs":21600000}}'::jsonb AS config
)
INSERT INTO pulse_cluster_classification_states (
  schema_version, cluster_id, incident_id, config_hash, config, status,
  attempt_count, max_attempts, first_attempt_at, last_attempt_at,
  next_retry_at, terminal_at, lease_expires_at, last_error_code,
  last_error_message, last_run_id, event_id, created_at, updated_at
)
SELECT
  'pulse-classification-state/v1', p.cluster_id, p.incident_id,
  config.config_hash, config.config, 'classified', 1, 3,
  p.created_at, p.created_at, NULL, p.created_at, NULL, NULL, NULL,
  p.classification_run_id, p.id, p.created_at, p.created_at
FROM pulse_events_v2 p
CROSS JOIN config
ON CONFLICT (cluster_id, config_hash) DO NOTHING;--> statement-breakpoint

WITH config AS (
  SELECT
    'pulse-classification-config/v1/sha256:cfc659092a62368cfa317933d9ed38439a1a9857fddaa21481520c5199b8644e'::text AS config_hash,
    '{"methodVersion":"pulse-v2.10-beta","ontologyVersion":"v2.0","algorithmVersion":"pulse-classification/ensemble-verify-subject-v2.1","classifierPromptVersion":"pulse-classifier-prompt/sha256:a5e4f860a48d61bc","publicationGateVersion":"pulse-publication-gate/ensemble-review-v2","classifyEngines":[{"provider":"deepseek","model":"deepseek-v4-flash"},{"provider":"glm","model":"glm-4.7"},{"provider":"anthropic","model":"claude-haiku-4-5"}],"verifyEngine":{"provider":"anthropic","model":"claude-haiku-4-5"},"subjectAttribution":{"provider":"anthropic","model":"claude-sonnet-4-6","attributionVersion":"pulse-jurisdiction-attribution/v2","promptVersion":"pulse-subject-attribution-prompt/sha256:d80d9f54b70860a6"},"decodeMode":"temperature-0-json","thinkingMode":"disabled","retryPolicy":{"maxAttempts":3,"initialDelayMs":900000,"multiplier":4,"maxDelayMs":21600000}}'::jsonb AS config
), terminal_raw AS (
  SELECT
    r.cluster_id,
    (array_remove(array_agg(DISTINCT r.incident_id), NULL))[1] AS incident_id,
    CASE
      WHEN bool_or(r.classification_disposition = 'invalid') THEN 'terminal_failure'
      ELSE 'none'
    END AS status,
    min(COALESCE(r.classified_at, r.clustered_at, r.retrieved_at)) AS decided_at,
    (array_agg(COALESCE(r.classification_run_id, r.cluster_run_id, r.ingest_run_id)
      ORDER BY COALESCE(r.classified_at, r.clustered_at, r.retrieved_at) DESC))[1] AS run_id
  FROM raw_events r
  WHERE r.cluster_id IS NOT NULL
    AND r.classification_disposition IN ('non_governance', 'invalid')
    AND NOT EXISTS (
      SELECT 1 FROM pulse_events_v2 p WHERE p.cluster_id = r.cluster_id
    )
  GROUP BY r.cluster_id
)
INSERT INTO pulse_cluster_classification_states (
  schema_version, cluster_id, incident_id, config_hash, config, status,
  attempt_count, max_attempts, first_attempt_at, last_attempt_at,
  next_retry_at, terminal_at, lease_expires_at, last_error_code,
  last_error_message, last_run_id, event_id, created_at, updated_at
)
SELECT
  'pulse-classification-state/v1', t.cluster_id, t.incident_id,
  config.config_hash, config.config, t.status, 1, 3,
  t.decided_at, t.decided_at, NULL, t.decided_at, NULL,
  CASE WHEN t.status = 'terminal_failure' THEN 'invalid_input' ELSE NULL END,
  CASE WHEN t.status = 'terminal_failure'
    THEN 'Retained invalid classifier input predates PUL-032 attempt-level error capture.'
    ELSE NULL END,
  t.run_id, NULL, t.decided_at, t.decided_at
FROM terminal_raw t
CROSS JOIN config
ON CONFLICT (cluster_id, config_hash) DO NOTHING;--> statement-breakpoint

INSERT INTO pulse_classification_attempts (
  schema_version, attempt_key, cluster_id, incident_id, config_hash, ordinal,
  run_id, outcome, model_call_count, started_at, completed_at, next_retry_at,
  error_code, error_message, metadata, created_at
)
SELECT
  'pulse-classification-attempt/v1',
  'pulse-classification-attempt/sha256:' || encode(
    digest(
      s.cluster_id::text || E'\n' || s.config_hash || E'\n1\n' ||
      s.last_run_id::text || E'\n' || s.status,
      'sha256'
    ),
    'hex'
  ),
  s.cluster_id, s.incident_id, s.config_hash, 1, s.last_run_id, s.status, 0,
  s.first_attempt_at, s.terminal_at, NULL, s.last_error_code,
  s.last_error_message,
  jsonb_build_object(
    'historicalBoundary', 'PUL-032',
    'modelCallCount', 'unknown_not_retained',
    'providerFailureDetail', 'unknown_not_retained'
  ),
  s.created_at
FROM pulse_cluster_classification_states s
WHERE s.status IN ('classified', 'none', 'terminal_failure')
ON CONFLICT (attempt_key) DO NOTHING;--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_validate_pulse_classification_state_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cluster_id <> OLD.cluster_id
     OR NEW.config_hash <> OLD.config_hash
     OR NEW.config <> OLD.config
     OR NEW.max_attempts <> OLD.max_attempts
     OR NEW.first_attempt_at <> OLD.first_attempt_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'pulse classification state identity/configuration is immutable';
  END IF;
  IF OLD.status IN ('classified', 'none', 'terminal_failure') THEN
    RAISE EXCEPTION 'terminal pulse classification state is immutable';
  END IF;
  IF NEW.attempt_count < OLD.attempt_count
     OR NEW.attempt_count > OLD.attempt_count + 1 THEN
    RAISE EXCEPTION 'pulse classification attempt count must advance by at most one';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_classification_state_transition_guard
BEFORE UPDATE ON pulse_cluster_classification_states
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_classification_state_update();--> statement-breakpoint

CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON pulse_cluster_classification_states
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_pulse_classification_attempt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_classification_attempts_append_only
BEFORE UPDATE OR DELETE ON pulse_classification_attempts
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_classification_attempt_mutation();

-- civica-affected-relations: pulse_classification_attempts,pulse_cluster_classification_states,pulse_events_v2,raw_events,pulse_event_decisions,pulse_pipeline_runs,research_evidence_history
