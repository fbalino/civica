CREATE TABLE "pulse_incident_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"assignment_key" text NOT NULL,
	"incident_id" uuid NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"raw_cluster_id" uuid NOT NULL,
	"match_kind" text NOT NULL,
	"semantic_similarity" real,
	"token_similarity" real NOT NULL,
	"anchor_overlap" real NOT NULL,
	"exact_normalized_match" boolean NOT NULL,
	"algorithm_version" text NOT NULL,
	"embedding_model" text,
	"fallback_mode" text NOT NULL,
	"stage_run_id" uuid NOT NULL,
	"actor" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"assigned_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_incident_assignments_contract_check" CHECK ("pulse_incident_assignments"."schema_version" = 'pulse-incident-assignment/v1' AND "pulse_incident_assignments"."assignment_key" ~ '^pulse-incident-assignment/sha256:[a-f0-9]{64}$' AND "pulse_incident_assignments"."match_kind" IN ('new','persisted_match','post_classification_merge','backfill') AND "pulse_incident_assignments"."token_similarity" BETWEEN 0 AND 1 AND "pulse_incident_assignments"."anchor_overlap" BETWEEN 0 AND 1 AND ("pulse_incident_assignments"."semantic_similarity" IS NULL OR "pulse_incident_assignments"."semantic_similarity" BETWEEN -1 AND 1) AND "pulse_incident_assignments"."algorithm_version" <> '' AND "pulse_incident_assignments"."fallback_mode" IN ('semantic','conservative_lexical','historical_backfill') AND jsonb_typeof("pulse_incident_assignments"."actor") = 'object' AND btrim("pulse_incident_assignments"."rationale") <> '')
);
--> statement-breakpoint
CREATE TABLE "pulse_incident_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" text NOT NULL,
	"resolution_key" text NOT NULL,
	"left_incident_id" uuid NOT NULL,
	"right_incident_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"canonical_incident_id" uuid,
	"signals" jsonb NOT NULL,
	"method_version" text NOT NULL,
	"stage_run_id" uuid NOT NULL,
	"actor" jsonb NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" text[] NOT NULL,
	"decided_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_incident_resolutions_contract_check" CHECK ("pulse_incident_resolutions"."schema_version" = 'pulse-incident-resolution/v1' AND "pulse_incident_resolutions"."resolution_key" ~ '^pulse-incident-resolution/sha256:[a-f0-9]{64}$' AND "pulse_incident_resolutions"."left_incident_id" <> "pulse_incident_resolutions"."right_incident_id" AND "pulse_incident_resolutions"."outcome" IN ('candidate','confirmed_merge','rejected','unresolved') AND jsonb_typeof("pulse_incident_resolutions"."signals") = 'object' AND jsonb_typeof("pulse_incident_resolutions"."actor") = 'object' AND "pulse_incident_resolutions"."method_version" <> '' AND btrim("pulse_incident_resolutions"."rationale") <> '' AND cardinality("pulse_incident_resolutions"."evidence_refs") > 0 AND (("pulse_incident_resolutions"."outcome" = 'confirmed_merge' AND "pulse_incident_resolutions"."canonical_incident_id" IN ("pulse_incident_resolutions"."left_incident_id", "pulse_incident_resolutions"."right_incident_id")) OR ("pulse_incident_resolutions"."outcome" <> 'confirmed_merge' AND "pulse_incident_resolutions"."canonical_incident_id" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "pulse_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"merged_into_incident_id" uuid,
	"representative_title" text NOT NULL,
	"event_date_start" date,
	"event_date_end" date,
	"identity_version" text NOT NULL,
	"identity_key" text NOT NULL,
	"identity_tokens" text[] NOT NULL,
	"identity_anchors" text[] NOT NULL,
	"representative_embedding" real[],
	"created_run_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_incidents_contract_check" CHECK ("pulse_incidents"."status" IN ('active','merged') AND btrim("pulse_incidents"."representative_title") <> '' AND "pulse_incidents"."identity_version" <> '' AND "pulse_incidents"."identity_key" ~ '^pulse-incident-identity/sha256:[a-f0-9]{64}$' AND (("pulse_incidents"."status" = 'active' AND "pulse_incidents"."merged_into_incident_id" IS NULL) OR ("pulse_incidents"."status" = 'merged' AND "pulse_incidents"."merged_into_incident_id" IS NOT NULL AND "pulse_incidents"."merged_into_incident_id" <> "pulse_incidents"."id")))
);
--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD COLUMN "projection_status" text DEFAULT 'current' NOT NULL;--> statement-breakpoint
ALTER TABLE "raw_events" ADD COLUMN "incident_id" uuid;--> statement-breakpoint

-- PUL-031 historical boundary: create one stable incident for every retained
-- event projection. Historical identity tokens/anchors were not retained, so
-- the backfill leaves those arrays empty instead of inventing them.
INSERT INTO "pulse_incidents" (
  "id", "status", "representative_title", "event_date_start",
  "event_date_end", "identity_version", "identity_key", "identity_tokens",
  "identity_anchors", "created_run_id", "created_at", "updated_at"
)
SELECT
  p.id,
  'active',
  COALESCE(
    NULLIF(btrim(p.headline), ''),
    NULLIF(left(btrim(p.description), 200), ''),
    'Quarantined retained incident ' || p.id::text
  ),
  p.event_date,
  p.event_date,
  'pulse-incident-identity/historical-backfill-v1',
  'pulse-incident-identity/sha256:' || encode(
    digest('event:' || p.id::text || E'\n' || COALESCE(p.headline, ''), 'sha256'),
    'hex'
  ),
  ARRAY[]::text[],
  ARRAY[]::text[],
  p.classification_run_id,
  p.created_at,
  p.updated_at
FROM pulse_events_v2 p
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- Create deterministic incidents for clustered raw groups that never produced
-- an event. Still-unclustered reports remain untouched so the incident-aware
-- runtime can compare them with persisted incidents after this migration.
WITH event_clusters AS (
  SELECT DISTINCT r.cluster_id
  FROM pulse_sources ps
  JOIN raw_events r ON r.id = ps.raw_event_id
  WHERE r.cluster_id IS NOT NULL
), raw_groups AS (
  SELECT
    COALESCE(r.cluster_id::text, 'raw:' || r.id::text) AS group_key,
    md5('pulse-incident-backfill:' || COALESCE(r.cluster_id::text, 'raw:' || r.id::text))::uuid AS incident_id,
    (array_agg(r.id ORDER BY r.id))[1] AS first_raw_id,
    COALESCE(
      NULLIF(btrim((array_agg(r.title ORDER BY r.id))[1]), ''),
      NULLIF(left(btrim((array_agg(COALESCE(r.body, '') ORDER BY r.id))[1]), 200), ''),
      'Unclassified retained report ' || (array_agg(r.id ORDER BY r.id))[1]::text
    ) AS representative_title,
    min(r.event_date) AS event_date_start,
    max(r.event_date) AS event_date_end,
    (array_agg(COALESCE(r.cluster_run_id, r.ingest_run_id) ORDER BY r.id))[1] AS created_run_id,
    min(COALESCE(r.clustered_at, r.retrieved_at)) AS created_at
  FROM raw_events r
  LEFT JOIN event_clusters ec ON ec.cluster_id = r.cluster_id
  WHERE ec.cluster_id IS NULL
    AND r.cluster_id IS NOT NULL
  GROUP BY COALESCE(r.cluster_id::text, 'raw:' || r.id::text),
           md5('pulse-incident-backfill:' || COALESCE(r.cluster_id::text, 'raw:' || r.id::text))::uuid
)
INSERT INTO "pulse_incidents" (
  "id", "status", "representative_title", "event_date_start",
  "event_date_end", "identity_version", "identity_key", "identity_tokens",
  "identity_anchors", "created_run_id", "created_at", "updated_at"
)
SELECT
  incident_id,
  'active',
  representative_title,
  event_date_start,
  event_date_end,
  'pulse-incident-identity/historical-backfill-v1',
  'pulse-incident-identity/sha256:' || encode(
    digest('raw-group:' || group_key || E'\n' || representative_title, 'sha256'),
    'hex'
  ),
  ARRAY[]::text[],
  ARRAY[]::text[],
  created_run_id,
  created_at,
  created_at
FROM raw_groups
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

UPDATE pulse_events_v2
SET incident_id = id;--> statement-breakpoint

-- Preserve the blank historical projection, but make it impossible to serve
-- or score. The retained-history trigger records the exact before/after row.
UPDATE pulse_events_v2
SET projection_status = 'quarantined_invalid',
    published = false,
    review_status = 'rejected',
    review_notes = concat_ws('; ', NULLIF(review_notes, ''), 'PUL-031: blank headline quarantined')
WHERE btrim(headline) = '';--> statement-breakpoint

WITH cluster_events AS (
  SELECT
    r.cluster_id,
    (array_agg(DISTINCT ps.event_id ORDER BY ps.event_id))[1] AS incident_id
  FROM pulse_sources ps
  JOIN raw_events r ON r.id = ps.raw_event_id
  WHERE r.cluster_id IS NOT NULL
  GROUP BY r.cluster_id
)
UPDATE raw_events r
SET incident_id = COALESCE(
  (SELECT ce.incident_id FROM cluster_events ce WHERE ce.cluster_id = r.cluster_id),
  md5('pulse-incident-backfill:' || COALESCE(r.cluster_id::text, 'raw:' || r.id::text))::uuid
)
WHERE r.cluster_id IS NOT NULL;--> statement-breakpoint

-- Legacy classifier state was not retained on raw rows. Reconstruct only the
-- directly provable event projection, then quarantine the known blank input.
UPDATE raw_events r
SET classification_disposition = 'event',
    classification_reason = 'PUL-031 historical event-linkage backfill',
    classification_decision = jsonb_build_object(
      'schemaVersion', 'pulse-incident-backfill/v1',
      'incidentId', p.incident_id,
      'historicalProjection', true
    ),
    classified_at = COALESCE(r.classified_at, p.created_at),
    classification_run_id = p.classification_run_id
FROM pulse_events_v2 p
WHERE p.incident_id = r.incident_id;--> statement-breakpoint

UPDATE raw_events
SET classification_disposition = 'invalid',
    classification_reason = 'PUL-031 blank source headline quarantine',
    classification_decision = jsonb_build_object(
      'schemaVersion', 'pulse-incident-backfill/v1',
      'reason', 'blank_headline'
    ),
    classified_at = COALESCE(classified_at, now())
WHERE btrim(title) = '';--> statement-breakpoint

INSERT INTO pulse_incident_assignments (
  schema_version, assignment_key, incident_id, raw_event_id, raw_cluster_id,
  match_kind, semantic_similarity, token_similarity, anchor_overlap,
  exact_normalized_match, algorithm_version, embedding_model, fallback_mode,
  stage_run_id, actor, rationale, assigned_at
)
SELECT
  'pulse-incident-assignment/v1',
  'pulse-incident-assignment/sha256:' || encode(
    digest('pulse-incident-assignment/v1' || E'\n' || r.id::text || E'\n' || r.incident_id::text, 'sha256'),
    'hex'
  ),
  r.incident_id,
  r.id,
  COALESCE(r.cluster_id, r.id),
  'backfill',
  NULL,
  0,
  0,
  false,
  'pulse-incident-backfill/v1',
  NULL,
  'historical_backfill',
  COALESCE(r.cluster_run_id, r.ingest_run_id),
  jsonb_build_object('type', 'legacy_projection', 'task', 'PUL-031'),
  'Historical assignment reconstructed from retained cluster/source linkage; match scores were not retained.',
  COALESCE(r.clustered_at, r.retrieved_at)
FROM raw_events r
WHERE r.incident_id IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

ALTER TABLE "pulse_events_v2" ALTER COLUMN "incident_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_incident_assignments" ADD CONSTRAINT "pulse_incident_assignments_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_assignments" ADD CONSTRAINT "pulse_incident_assignments_raw_event_id_raw_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_assignments" ADD CONSTRAINT "pulse_incident_assignments_stage_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("stage_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_resolutions" ADD CONSTRAINT "pulse_incident_resolutions_left_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("left_incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_resolutions" ADD CONSTRAINT "pulse_incident_resolutions_right_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("right_incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_resolutions" ADD CONSTRAINT "pulse_incident_resolutions_canonical_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("canonical_incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incident_resolutions" ADD CONSTRAINT "pulse_incident_resolutions_stage_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("stage_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incidents" ADD CONSTRAINT "pulse_incidents_created_run_id_pulse_pipeline_runs_id_fk" FOREIGN KEY ("created_run_id") REFERENCES "public"."pulse_pipeline_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_incidents" ADD CONSTRAINT "pulse_incidents_merged_into_fk" FOREIGN KEY ("merged_into_incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_incident_assignments_key" ON "pulse_incident_assignments" USING btree ("assignment_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_incident_assignments_raw" ON "pulse_incident_assignments" USING btree ("raw_event_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_incident_assignments_incident" ON "pulse_incident_assignments" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_incident_assignments_run" ON "pulse_incident_assignments" USING btree ("stage_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_incident_resolutions_key" ON "pulse_incident_resolutions" USING btree ("resolution_key");--> statement-breakpoint
CREATE INDEX "idx_pulse_incident_resolutions_pair" ON "pulse_incident_resolutions" USING btree ("left_incident_id","right_incident_id","decided_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_incident_resolutions_run" ON "pulse_incident_resolutions" USING btree ("stage_run_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_incidents_status_date" ON "pulse_incidents" USING btree ("status","event_date_start","event_date_end");--> statement-breakpoint
CREATE INDEX "idx_pulse_incidents_identity" ON "pulse_incidents" USING btree ("identity_key");--> statement-breakpoint
CREATE INDEX "idx_pulse_incidents_created_run" ON "pulse_incidents" USING btree ("created_run_id");--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_events" ADD CONSTRAINT "raw_events_incident_id_pulse_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."pulse_incidents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_v2_one_current_projection" ON "pulse_events_v2" USING btree ("incident_id") WHERE "pulse_events_v2"."projection_status" = 'current';--> statement-breakpoint
CREATE INDEX "idx_pulse_v2_incident" ON "pulse_events_v2" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_raw_events_incident" ON "raw_events" USING btree ("incident_id");--> statement-breakpoint
ALTER TABLE "pulse_events_v2" ADD CONSTRAINT "pulse_events_v2_projection_check" CHECK ("pulse_events_v2"."projection_status" IN ('current','superseded_duplicate','quarantined_invalid') AND (("pulse_events_v2"."projection_status" = 'quarantined_invalid' AND "pulse_events_v2"."published" = false) OR ("pulse_events_v2"."projection_status" <> 'quarantined_invalid' AND btrim("pulse_events_v2"."headline") <> '')) AND (("pulse_events_v2"."projection_status" = 'current') OR ("pulse_events_v2"."published" = false))); 

CREATE OR REPLACE FUNCTION civica_validate_pulse_incident_merge()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cycle_found boolean;
BEGIN
  IF NEW.status = 'merged' THEN
    WITH RECURSIVE chain(id, merged_into_incident_id) AS (
      SELECT i.id, i.merged_into_incident_id
      FROM pulse_incidents i
      WHERE i.id = NEW.merged_into_incident_id
      UNION ALL
      SELECT i.id, i.merged_into_incident_id
      FROM pulse_incidents i
      JOIN chain c ON i.id = c.merged_into_incident_id
    )
    SELECT EXISTS (SELECT 1 FROM chain WHERE id = NEW.id) INTO cycle_found;
    IF cycle_found THEN
      RAISE EXCEPTION 'pulse incident merge cycle detected for %', NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_incidents_validate_merge
BEFORE INSERT OR UPDATE ON pulse_incidents
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_incident_merge();--> statement-breakpoint

CREATE TRIGGER dat_016_retain_mutation
BEFORE UPDATE OR DELETE ON pulse_incidents
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint

CREATE OR REPLACE FUNCTION civica_reject_pulse_incident_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;--> statement-breakpoint

CREATE TRIGGER pulse_incident_assignments_append_only
BEFORE UPDATE OR DELETE ON pulse_incident_assignments
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_incident_evidence_mutation();--> statement-breakpoint

CREATE TRIGGER pulse_incident_resolutions_append_only
BEFORE UPDATE OR DELETE ON pulse_incident_resolutions
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_incident_evidence_mutation();
-- civica-affected-relations: pulse_incident_assignments,pulse_incident_resolutions,pulse_incidents,pulse_events_v2,raw_events,pulse_sources,pulse_pipeline_runs,research_evidence_history
