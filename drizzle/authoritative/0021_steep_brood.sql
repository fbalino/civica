CREATE TABLE "pulse_coding_adjudications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"adjudicator_assignment_id" uuid NOT NULL,
	"comparison" jsonb NOT NULL,
	"comparison_sha256" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" jsonb,
	"resolution_sha256" text,
	"reason_codes" text[] NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "pulse_coding_adjudications_packet_id_unique" UNIQUE("packet_id"),
	CONSTRAINT "pulse_coding_adjudications_contract_check" CHECK ("pulse_coding_adjudications"."comparison_sha256" ~ '^[a-f0-9]{64}$' AND "pulse_coding_adjudications"."status" IN ('pending','resolved','unresolved') AND jsonb_typeof("pulse_coding_adjudications"."comparison") = 'object' AND (("pulse_coding_adjudications"."status" = 'pending' AND "pulse_coding_adjudications"."resolution" IS NULL AND "pulse_coding_adjudications"."resolution_sha256" IS NULL AND "pulse_coding_adjudications"."resolved_at" IS NULL) OR ("pulse_coding_adjudications"."status" IN ('resolved','unresolved') AND "pulse_coding_adjudications"."resolution" IS NOT NULL AND "pulse_coding_adjudications"."resolution_sha256" ~ '^[a-f0-9]{64}$' AND "pulse_coding_adjudications"."resolved_at" IS NOT NULL AND cardinality("pulse_coding_adjudications"."reason_codes") > 0)))
);
--> statement-breakpoint
CREATE TABLE "pulse_coding_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"draft" jsonb,
	"draft_sha256" text,
	"submission" jsonb,
	"submission_sha256" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"draft_updated_at" timestamp,
	"locked_at" timestamp,
	CONSTRAINT "pulse_coding_assignments_contract_check" CHECK ("pulse_coding_assignments"."slot" IN ('coder_a','coder_b','adjudicator') AND "pulse_coding_assignments"."status" IN ('assigned','draft','locked') AND ("pulse_coding_assignments"."draft_sha256" IS NULL OR "pulse_coding_assignments"."draft_sha256" ~ '^[a-f0-9]{64}$') AND ("pulse_coding_assignments"."submission_sha256" IS NULL OR "pulse_coding_assignments"."submission_sha256" ~ '^[a-f0-9]{64}$') AND (("pulse_coding_assignments"."status" = 'locked' AND "pulse_coding_assignments"."submission" IS NOT NULL AND "pulse_coding_assignments"."submission_sha256" IS NOT NULL AND "pulse_coding_assignments"."locked_at" IS NOT NULL) OR ("pulse_coding_assignments"."status" <> 'locked' AND "pulse_coding_assignments"."submission" IS NULL AND "pulse_coding_assignments"."submission_sha256" IS NULL AND "pulse_coding_assignments"."locked_at" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "pulse_coding_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid,
	"packet_id" uuid,
	"participant_id" uuid,
	"actor_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"request_id" text,
	"before_sha256" text,
	"after_sha256" text,
	"details" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_coding_audit_log_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "pulse_coding_audit_contract_check" CHECK ("pulse_coding_audit_log"."actor_role" IN ('coder','adjudicator','study_admin','system','anonymous') AND "pulse_coding_audit_log"."action" IN ('study_created','packet_imported','participant_issued','participant_revoked','assignment_created','draft_saved','submission_locked','comparison_generated','adjudication_recorded','export_generated','access_granted','access_denied') AND "pulse_coding_audit_log"."entity_type" <> '' AND jsonb_typeof("pulse_coding_audit_log"."details") = 'object' AND ("pulse_coding_audit_log"."before_sha256" IS NULL OR "pulse_coding_audit_log"."before_sha256" ~ '^[a-f0-9]{64}$') AND ("pulse_coding_audit_log"."after_sha256" IS NULL OR "pulse_coding_audit_log"."after_sha256" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
CREATE TABLE "pulse_coding_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"packet_key" text NOT NULL,
	"analysis_status" text NOT NULL,
	"packet_snapshot" jsonb NOT NULL,
	"packet_snapshot_sha256" text NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_coding_packets_contract_check" CHECK ("pulse_coding_packets"."analysis_status" IN ('analysis_candidate','reserve','pilot') AND "pulse_coding_packets"."packet_snapshot_sha256" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("pulse_coding_packets"."packet_snapshot") = 'object')
);
--> statement-breakpoint
CREATE TABLE "pulse_coding_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_id" uuid NOT NULL,
	"pseudonym" text NOT NULL,
	"role" text NOT NULL,
	"actor_type" text NOT NULL,
	"use_status" text NOT NULL,
	"credential_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"last_access_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "pulse_coding_participants_credential_hash_unique" UNIQUE("credential_hash"),
	CONSTRAINT "pulse_coding_participants_contract_check" CHECK ("pulse_coding_participants"."role" IN ('coder','adjudicator','study_admin') AND "pulse_coding_participants"."actor_type" IN ('qualified_human','agent_dry_pilot') AND "pulse_coding_participants"."use_status" IN ('evaluation_candidate','dry_run_not_gold') AND "pulse_coding_participants"."status" IN ('active','revoked') AND "pulse_coding_participants"."credential_hash" ~ '^[a-f0-9]{64}$' AND ("pulse_coding_participants"."actor_type" <> 'agent_dry_pilot' OR "pulse_coding_participants"."use_status" = 'dry_run_not_gold'))
);
--> statement-breakpoint
CREATE TABLE "pulse_coding_studies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"schema_version" text NOT NULL,
	"title" text NOT NULL,
	"purpose" text NOT NULL,
	"protocol_version" text NOT NULL,
	"codebook_version" text NOT NULL,
	"ontology_version" text NOT NULL,
	"dataset_version" text NOT NULL,
	"packet_set_sha256" text NOT NULL,
	"trace_set_sha256" text,
	"status" text DEFAULT 'setup' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	CONSTRAINT "pulse_coding_studies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "pulse_coding_studies_contract_check" CHECK ("pulse_coding_studies"."schema_version" = 'pulse-coding-workspace/v1' AND "pulse_coding_studies"."purpose" IN ('instruction_pilot','evaluation') AND "pulse_coding_studies"."status" IN ('setup','active','closed') AND "pulse_coding_studies"."protocol_version" <> '' AND "pulse_coding_studies"."codebook_version" <> '' AND "pulse_coding_studies"."ontology_version" <> '' AND "pulse_coding_studies"."dataset_version" <> '' AND "pulse_coding_studies"."packet_set_sha256" ~ '^[a-f0-9]{64}$' AND ("pulse_coding_studies"."trace_set_sha256" IS NULL OR "pulse_coding_studies"."trace_set_sha256" ~ '^[a-f0-9]{64}$'))
);
--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD CONSTRAINT "pulse_coding_adjudications_packet_id_pulse_coding_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."pulse_coding_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD CONSTRAINT "pulse_coding_adjudications_adjudicator_assignment_id_pulse_coding_assignments_id_fk" FOREIGN KEY ("adjudicator_assignment_id") REFERENCES "public"."pulse_coding_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_assignments" ADD CONSTRAINT "pulse_coding_assignments_packet_id_pulse_coding_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."pulse_coding_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_assignments" ADD CONSTRAINT "pulse_coding_assignments_participant_id_pulse_coding_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."pulse_coding_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_audit_log" ADD CONSTRAINT "pulse_coding_audit_log_study_id_pulse_coding_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."pulse_coding_studies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_audit_log" ADD CONSTRAINT "pulse_coding_audit_log_packet_id_pulse_coding_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."pulse_coding_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_audit_log" ADD CONSTRAINT "pulse_coding_audit_log_participant_id_pulse_coding_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."pulse_coding_participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_packets" ADD CONSTRAINT "pulse_coding_packets_study_id_pulse_coding_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."pulse_coding_studies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_participants" ADD CONSTRAINT "pulse_coding_participants_study_id_pulse_coding_studies_id_fk" FOREIGN KEY ("study_id") REFERENCES "public"."pulse_coding_studies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_adjudication_status" ON "pulse_coding_adjudications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_assignment_slot" ON "pulse_coding_assignments" USING btree ("packet_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_assignment_participant" ON "pulse_coding_assignments" USING btree ("packet_id","participant_id");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_assignment_queue" ON "pulse_coding_assignments" USING btree ("participant_id","status","assigned_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_audit_study" ON "pulse_coding_audit_log" USING btree ("study_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_audit_packet" ON "pulse_coding_audit_log" USING btree ("packet_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_audit_actor" ON "pulse_coding_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_packet_key" ON "pulse_coding_packets" USING btree ("study_id","packet_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_packet_hash" ON "pulse_coding_packets" USING btree ("study_id","packet_snapshot_sha256");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_packet_status" ON "pulse_coding_packets" USING btree ("study_id","analysis_status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_participant_pseudonym" ON "pulse_coding_participants" USING btree ("study_id","pseudonym");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_participant_role" ON "pulse_coding_participants" USING btree ("study_id","role","status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pulse_coding_study_identity" ON "pulse_coding_studies" USING btree ("protocol_version","packet_set_sha256");--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_study_status" ON "pulse_coding_studies" USING btree ("status","created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_pulse_coding_has_forbidden_field(payload jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH RECURSIVE walk(value) AS (
    SELECT COALESCE(payload, 'null'::jsonb)
    UNION ALL
    SELECT child.value
    FROM walk
    CROSS JOIN LATERAL (
      SELECT entry.value
      FROM jsonb_each(
        CASE WHEN jsonb_typeof(walk.value) = 'object'
          THEN walk.value ELSE '{}'::jsonb END
      ) AS entry
      UNION ALL
      SELECT element.value
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(walk.value) = 'array'
          THEN walk.value ELSE '[]'::jsonb END
      ) AS element(value)
    ) AS child
  )
  SELECT EXISTS (
    SELECT 1
    FROM walk
    CROSS JOIN LATERAL jsonb_object_keys(
      CASE WHEN jsonb_typeof(walk.value) = 'object'
        THEN walk.value ELSE '{}'::jsonb END
    ) AS object_key(key)
    WHERE object_key.key IN (
      'productionLabel', 'productionDisposition', 'publishedStatus',
      'modelVote', 'modelConfidence', 'ownerApproval',
      'otherCoderSubmission', 'adjudicatedAnswer', 'goldLabel', 'truth'
    )
  );
$$;
--> statement-breakpoint
ALTER TABLE "pulse_coding_packets"
ADD CONSTRAINT "pulse_coding_packets_blind_payload_check"
CHECK (NOT civica_pulse_coding_has_forbidden_field("packet_snapshot"));
--> statement-breakpoint
ALTER TABLE "pulse_coding_assignments"
ADD CONSTRAINT "pulse_coding_assignments_blind_payload_check"
CHECK (
  NOT civica_pulse_coding_has_forbidden_field("draft")
  AND NOT civica_pulse_coding_has_forbidden_field("submission")
);
--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications"
ADD CONSTRAINT "pulse_coding_adjudications_blind_payload_check"
CHECK (
  NOT civica_pulse_coding_has_forbidden_field("comparison")
  AND NOT civica_pulse_coding_has_forbidden_field("resolution")
);
--> statement-breakpoint
ALTER TABLE "pulse_coding_audit_log"
ADD CONSTRAINT "pulse_coding_audit_blind_payload_check"
CHECK (NOT civica_pulse_coding_has_forbidden_field("details"));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_validate_pulse_coding_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  participant_role text;
  participant_study uuid;
  packet_study uuid;
BEGIN
  SELECT role, study_id
  INTO participant_role, participant_study
  FROM pulse_coding_participants
  WHERE id = NEW.participant_id;

  SELECT study_id
  INTO packet_study
  FROM pulse_coding_packets
  WHERE id = NEW.packet_id;

  IF participant_study IS DISTINCT FROM packet_study THEN
    RAISE EXCEPTION 'Pulse coding participant and packet belong to different studies';
  END IF;
  IF NEW.slot IN ('coder_a', 'coder_b') AND participant_role <> 'coder' THEN
    RAISE EXCEPTION 'Pulse coding coder slots require a coder participant';
  END IF;
  IF NEW.slot = 'adjudicator' AND participant_role <> 'adjudicator' THEN
    RAISE EXCEPTION 'Pulse coding adjudicator slot requires an adjudicator participant';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_assignment_role_guard
BEFORE INSERT OR UPDATE OF packet_id, participant_id, slot
ON "pulse_coding_assignments"
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_coding_assignment();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_protect_locked_pulse_coding_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pulse coding assignments cannot be deleted';
  END IF;
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Locked Pulse coding submissions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_assignment_lock_guard
BEFORE UPDATE OR DELETE ON "pulse_coding_assignments"
FOR EACH ROW EXECUTE FUNCTION civica_protect_locked_pulse_coding_assignment();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_validate_pulse_coding_adjudication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_packet uuid;
  assignment_slot text;
BEGIN
  SELECT packet_id, slot
  INTO assignment_packet, assignment_slot
  FROM pulse_coding_assignments
  WHERE id = NEW.adjudicator_assignment_id;

  IF assignment_packet IS DISTINCT FROM NEW.packet_id
     OR assignment_slot <> 'adjudicator' THEN
    RAISE EXCEPTION 'Pulse coding adjudication requires the packet adjudicator assignment';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_adjudicator_guard
BEFORE INSERT OR UPDATE OF packet_id, adjudicator_assignment_id
ON "pulse_coding_adjudications"
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_coding_adjudication();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_protect_terminal_pulse_coding_adjudication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pulse coding adjudications cannot be deleted';
  END IF;
  IF OLD.status IN ('resolved', 'unresolved') THEN
    RAISE EXCEPTION 'Terminal Pulse coding adjudications are immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_adjudication_terminal_guard
BEFORE UPDATE OR DELETE ON "pulse_coding_adjudications"
FOR EACH ROW EXECUTE FUNCTION civica_protect_terminal_pulse_coding_adjudication();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_reject_pulse_coding_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Pulse coding packets and audit rows are append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_packets_append_only
BEFORE UPDATE OR DELETE ON "pulse_coding_packets"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_coding_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER pulse_coding_audit_append_only
BEFORE UPDATE OR DELETE ON "pulse_coding_audit_log"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_coding_evidence_mutation();
