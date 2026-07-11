CREATE TABLE "pulse_pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"version_key" text NOT NULL,
	"versions" jsonb NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "pulse_pipeline_runs_stage_check" CHECK ("pulse_pipeline_runs"."stage" IN ('ingest','cluster','classify','corroborate','review','score')),
	CONSTRAINT "pulse_pipeline_runs_status_check" CHECK ("pulse_pipeline_runs"."status" IN ('running','completed','partial','failed','legacy')),
	CONSTRAINT "pulse_pipeline_runs_completion_check" CHECK (("pulse_pipeline_runs"."status" = 'running' AND "pulse_pipeline_runs"."completed_at" IS NULL) OR ("pulse_pipeline_runs"."status" <> 'running' AND "pulse_pipeline_runs"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD COLUMN "computation_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD COLUMN "classification_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD COLUMN "publication_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD COLUMN "corroboration_run_id" uuid;--> statement-breakpoint
ALTER TABLE "pulse_review_audit_log" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "ingest_run_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "cluster_run_id" uuid;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "classification_run_id" uuid;--> statement-breakpoint
WITH legacy(id, stage, version_key) AS (
	VALUES
		('00000000-0000-4000-8000-000000000001'::uuid, 'ingest', 'pulse-stage/sha256:b06eb29ceece5132bdecb2171218f37f6b63ac8ab4fcee8d336dd7215acde2c6'),
		('00000000-0000-4000-8000-000000000002'::uuid, 'cluster', 'pulse-stage/sha256:458682c22ddb1ccd99b6e3ba78afa006f436d2816fd4ee6adcfbda15b4d38b9c'),
		('00000000-0000-4000-8000-000000000003'::uuid, 'classify', 'pulse-stage/sha256:2d47777ebd03713fb2198dceb70648c77f3232b52878ce08e4cb9bc5873f107b'),
		('00000000-0000-4000-8000-000000000004'::uuid, 'corroborate', 'pulse-stage/sha256:d011ec2be6927bbd393d41cbda08c378bfe40ae80551ff1605c286223b341148'),
		('00000000-0000-4000-8000-000000000005'::uuid, 'review', 'pulse-stage/sha256:c5c0c3c0ff9f9e8da8ca911d7d6b66608fb2c48ca0a41e3eafef98ba8cba80c3'),
		('00000000-0000-4000-8000-000000000006'::uuid, 'score', 'pulse-stage/sha256:201a88208e5299db96a133571a611b7ca355ccf672538c46a20926d8debe965e')
)
INSERT INTO "pulse_pipeline_runs" (
	"id", "stage", "status", "version_key", "versions", "counts", "failures", "started_at", "completed_at"
)
SELECT
	id,
	stage,
	'legacy',
	version_key,
	jsonb_build_object(
		'schemaVersion', 'pulse-stage-version-envelope/v1',
		'stage', stage,
		'methodology', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'ontology', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'pipeline', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'algorithm', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'prompt', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'sourceBasket', jsonb_build_object('state', 'legacy_unversioned', 'reason', 'Retained ' || stage || ' history predates PUL-004 row-level pipeline-run versioning.'),
		'sourceIds', '[]'::jsonb,
		'models', '[]'::jsonb,
		'upstreamRunIds', '[]'::jsonb
	),
	'{}'::jsonb,
	'[]'::jsonb,
	now(),
	now()
FROM legacy;--> statement-breakpoint
UPDATE "raw_events" SET "ingest_run_id" = '00000000-0000-4000-8000-000000000001'::uuid;--> statement-breakpoint
UPDATE "raw_events" SET "cluster_run_id" = '00000000-0000-4000-8000-000000000002'::uuid WHERE "cluster_id" IS NOT NULL;--> statement-breakpoint
UPDATE "raw_events" SET "classification_run_id" = '00000000-0000-4000-8000-000000000003'::uuid WHERE "classified_at" IS NOT NULL OR "classification_disposition" <> 'pending';--> statement-breakpoint
UPDATE "pulse_events_v2" SET
	"classification_run_id" = '00000000-0000-4000-8000-000000000003'::uuid,
	"publication_run_id" = CASE WHEN "published" THEN '00000000-0000-4000-8000-000000000003'::uuid ELSE NULL END,
	"corroboration_run_id" = '00000000-0000-4000-8000-000000000004'::uuid;--> statement-breakpoint
UPDATE "pulse_review_audit_log" SET "run_id" = '00000000-0000-4000-8000-000000000005'::uuid;--> statement-breakpoint
UPDATE "pulse_dimensional_deltas" SET "computation_run_id" = '00000000-0000-4000-8000-000000000006'::uuid;--> statement-breakpoint
ALTER TABLE "raw_events" ALTER COLUMN "ingest_run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ALTER COLUMN "classification_run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_review_audit_log" ALTER COLUMN "run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ALTER COLUMN "computation_run_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_pulse_pipeline_runs_stage_time" ON "pulse_pipeline_runs" USING btree ("stage","started_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_pipeline_runs_version" ON "pulse_pipeline_runs" USING btree ("version_key");--> statement-breakpoint
ALTER TABLE "pulse_dimensional_deltas" ADD CONSTRAINT "pulse_dimensional_deltas_computation_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("computation_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_classification_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_publication_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("publication_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_corroboration_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("corroboration_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_review_audit_log" ADD CONSTRAINT "pulse_review_audit_log_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_ingest_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("ingest_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_cluster_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("cluster_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_classification_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("classification_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_dim_computation_run" ON "pulse_dimensional_deltas" USING btree ("computation_run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_classification_run" ON "pulse_events_v2" USING btree ("classification_run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_publication_run" ON "pulse_events_v2" USING btree ("publication_run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_corroboration_run" ON "pulse_events_v2" USING btree ("corroboration_run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_review_audit_run" ON "pulse_review_audit_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_raw_events_ingest_run" ON "raw_events" USING btree ("ingest_run_id");--> statement-breakpoint
CREATE INDEX "idx_raw_events_cluster_run" ON "raw_events" USING btree ("cluster_run_id");--> statement-breakpoint
CREATE INDEX "idx_raw_events_classification_run" ON "raw_events" USING btree ("classification_run_id");
--> statement-breakpoint
CREATE FUNCTION pul_004_guard_pipeline_run() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Pulse pipeline runs are retained evidence and cannot be deleted';
	END IF;
	IF OLD.id IS DISTINCT FROM NEW.id
		OR OLD.stage IS DISTINCT FROM NEW.stage
		OR OLD.version_key IS DISTINCT FROM NEW.version_key
		OR OLD.versions IS DISTINCT FROM NEW.versions
		OR OLD.started_at IS DISTINCT FROM NEW.started_at THEN
		RAISE EXCEPTION 'Pulse pipeline version identity is immutable';
	END IF;
	IF OLD.status <> 'running' THEN
		RAISE EXCEPTION 'Completed, failed, and legacy Pulse pipeline runs are immutable';
	END IF;
	IF NEW.status NOT IN ('completed', 'partial', 'failed') OR NEW.completed_at IS NULL THEN
		RAISE EXCEPTION 'A running Pulse pipeline run may only close to a terminal status';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER pul_004_pipeline_run_immutable
BEFORE UPDATE OR DELETE ON "pulse_pipeline_runs"
FOR EACH ROW EXECUTE FUNCTION pul_004_guard_pipeline_run();--> statement-breakpoint
CREATE FUNCTION pul_004_guard_raw_lineage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.ingest_run_id IS DISTINCT FROM NEW.ingest_run_id THEN
		RAISE EXCEPTION 'Raw-event ingest lineage is immutable';
	END IF;
	IF OLD.cluster_run_id IS NOT NULL AND OLD.cluster_run_id IS DISTINCT FROM NEW.cluster_run_id THEN
		RAISE EXCEPTION 'Raw-event cluster lineage is write-once';
	END IF;
	IF OLD.classification_run_id IS NOT NULL AND OLD.classification_run_id IS DISTINCT FROM NEW.classification_run_id THEN
		RAISE EXCEPTION 'Raw-event classification lineage is write-once';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER pul_004_raw_lineage_write_once
BEFORE UPDATE ON "raw_events"
FOR EACH ROW EXECUTE FUNCTION pul_004_guard_raw_lineage();--> statement-breakpoint
CREATE FUNCTION pul_004_guard_event_classification_lineage() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.classification_run_id IS DISTINCT FROM NEW.classification_run_id THEN
		RAISE EXCEPTION 'Pulse event classification lineage is immutable';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER pul_004_event_classification_lineage_immutable
BEFORE UPDATE ON "pulse_events_v2"
FOR EACH ROW EXECUTE FUNCTION pul_004_guard_event_classification_lineage();
